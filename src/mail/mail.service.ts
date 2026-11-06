// src/mail/mail.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * ส่งเมลได้สี่ทาง เลือกตามค่า env ที่ตั้งไว้ ไล่ลำดับดังนี้
 *
 * G. GMAIL_SCRIPT_URL คู่กับ GMAIL_SCRIPT_SECRET ส่งจาก Gmail ผ่าน Google Apps Script
 *    ไม่ต้องมีโดเมน ไม่ต้องยืนยันเบอร์ ส่งได้ประมาณ 100 ฉบับต่อวันกับบัญชี Gmail ฟรี
 *    ตัวสคริปต์อยู่ที่ scripts/gmail-relay.gs
 * 0. BREVO_API_KEY ส่งผ่าน HTTPS API ของ Brevo (ชื่อเดิม Sendinblue)
 *    ยืนยันแค่อีเมลผู้ส่ง (FROM_EMAIL) ในบัญชี Brevo ไม่ต้องมีโดเมน
 *    ส่งหาผู้รับรายใดก็ได้ ฟรีวันละ 300 ฉบับ
 * 1. MAILJET_API_KEY คู่กับ MAILJET_SECRET_KEY ส่งผ่าน HTTPS API ของ Mailjet
 *    ยืนยันแค่อีเมลผู้ส่งรายตัว ไม่ต้องมีโดเมนของตัวเอง
 *    จึงส่งหาผู้รับรายใดก็ได้ตั้งแต่วันแรก
 * 2. RESEND_API_KEY ส่งผ่าน HTTPS API ของ Resend
 *    บัญชีที่ยังไม่ยืนยันโดเมน ส่งได้เฉพาะไปยังอีเมลเจ้าของบัญชี
 * 3. ไม่ตั้งทั้งคู่ ถอยไปใช้ SMTP ผ่าน nodemailer
 *
 * ทางที่ 1 กับ 2 วิ่งบนพอร์ต 443 ซึ่งจำเป็นบนโฮสต์อย่าง Render free tier
 * ที่บล็อกพอร์ต SMTP ขาออกทุกพอร์ต ทั้ง 587 และ 465 ต่อไม่ติดเหมือนกัน
 * ส่วนทางที่ 3 ยังสะดวกกว่าตอนพัฒนาบนเครื่องตัวเอง
 */
type MailProvider = 'gmail' | 'brevo' | 'mailjet' | 'resend' | 'smtp';

@Injectable()
export class MailService {
  private transporter?: nodemailer.Transporter;
  private readonly provider: MailProvider;
  private readonly mailjetApiKey?: string;
  private readonly mailjetSecretKey?: string;
  private readonly resendApiKey?: string;
  private readonly brevoApiKey?: string;
  private readonly gmailScriptUrl?: string;
  private readonly gmailScriptSecret?: string;

  constructor(private readonly configService: ConfigService) {
    this.mailjetApiKey = this.configService.get<string>('MAILJET_API_KEY');
    this.mailjetSecretKey =
      this.configService.get<string>('MAILJET_SECRET_KEY');
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    this.brevoApiKey = this.configService.get<string>('BREVO_API_KEY');
    this.gmailScriptUrl = this.configService.get<string>('GMAIL_SCRIPT_URL');
    this.gmailScriptSecret = this.configService.get<string>('GMAIL_SCRIPT_SECRET');

    if (this.gmailScriptUrl && this.gmailScriptSecret) {
      this.provider = 'gmail';
      console.log('==== MAIL: Gmail ผ่าน Google Apps Script ====');
      return;
    }

    if (this.gmailScriptUrl || this.gmailScriptSecret) {
      console.error('Gmail ต้องมีทั้ง GMAIL_SCRIPT_URL และ GMAIL_SCRIPT_SECRET ตอนนี้มีไม่ครบ จึงข้ามไปใช้ทางอื่น');
    }

    if (this.brevoApiKey) {
      this.provider = 'brevo';
      const sender = this.configuredFrom();
      console.log('==== MAIL: Brevo HTTPS API ====');
      console.log('FROM_EMAIL =', sender);
      console.log('===============================');
      if (!sender) {
        console.error(
          'ยังไม่ได้ตั้ง FROM_EMAIL ส่งเมลผ่าน Brevo จะไม่ทำงาน ตั้งเป็นอีเมลผู้ส่งที่ยืนยันไว้ในบัญชี Brevo',
        );
      }
      return;
    }

    if (this.mailjetApiKey && this.mailjetSecretKey) {
      this.provider = 'mailjet';
      const sender = this.configuredFrom();
      console.log('==== MAIL: Mailjet HTTPS API ====');
      console.log('FROM_EMAIL =', sender);
      console.log('=================================');
      // เตือนตั้งแต่ตอน boot ดีกว่าปล่อยให้ไปพังตอนมีคนสมัครจริง
      if (!sender) {
        console.error(
          'ยังไม่ได้ตั้ง FROM_EMAIL ส่งเมลผ่าน Mailjet จะไม่ทำงาน ตั้งเป็นอีเมลผู้ส่งที่ยืนยันไว้ในบัญชี Mailjet',
        );
      }
      return;
    }

    // ตั้งมาแค่ตัวเดียวคือตั้งไม่ครบ Mailjet ต้องใช้ทั้งคู่เสมอ
    if (this.mailjetApiKey || this.mailjetSecretKey) {
      console.error(
        'Mailjet ต้องมีทั้ง MAILJET_API_KEY และ MAILJET_SECRET_KEY ตอนนี้มีไม่ครบ จึงข้ามไปใช้ทางอื่น',
      );
    }

    if (this.resendApiKey) {
      this.provider = 'resend';
      console.log('==== MAIL: Resend HTTPS API ====');
      console.log('FROM_EMAIL =', this.fromAddress());
      console.log('================================');
      return;
    }

    this.provider = 'smtp';
    this.setupSmtp();
  }

  private setupSmtp(): void {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<string>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    const portNumber = Number(port) || 587;

    // พอร์ต 465 คุยกันด้วย TLS ตั้งแต่วินาทีแรก ต้อง secure เป็น true
    // ส่วน 587 เริ่มแบบ plain แล้วค่อยยกระดับด้วย STARTTLS จึงต้องเป็น false
    const secureSetting = this.configService.get<string>('SMTP_SECURE');
    const secure =
      secureSetting !== undefined
        ? secureSetting === 'true'
        : portNumber === 465;

    console.log('==== MAIL: SMTP ====');
    console.log('SMTP_HOST =', host);
    console.log('SMTP_PORT =', portNumber);
    console.log('SMTP_SECURE =', secure);
    console.log('SMTP_USER =', user);
    console.log('SMTP_PASS =', pass ? '***' : undefined);
    console.log('====================');

    if (user && !user.includes('@')) {
      console.error(
        `SMTP_USER ไม่ใช่อีเมล ได้ค่ามาเป็น "${user}" กรุณาตั้งเป็นอีเมลที่ใช้ส่งจริง`,
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: portNumber,
      secure,
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });

    this.transporter.verify((error) => {
      if (error) {
        console.error('SMTP verify error:', error);
        console.error(
          'ส่งเมลจะไม่ทำงานจนกว่าจะแก้ ถ้าโฮสต์บล็อกพอร์ต SMTP ให้ตั้ง BREVO_API_KEY แทน',
        );
      } else {
        console.log('SMTP server is ready to take messages');
      }
    });
  }

  private configuredFrom(): string | undefined {
    return (
      this.configService.get<string>('FROM_EMAIL') ||
      this.configService.get<string>('SMTP_USER')
    );
  }

  private fromAddress(): string {
    const configured = this.configuredFrom();

    if (configured) {
      return configured;
    }

    // Mailjet ไม่มีโดเมนกลางให้ยืม ผู้ส่งต้องเป็นอีเมลที่ยืนยันไว้ในบัญชีเท่านั้น
    // จึงปล่อยว่างไม่ได้ ต้องบอกให้ชัดตั้งแต่ตอนเรียกใช้
    if (this.provider === 'mailjet' || this.provider === 'brevo') {
      throw new Error(
        `ใช้ ${this.provider === 'brevo' ? 'Brevo' : 'Mailjet'} ต้องตั้ง FROM_EMAIL เป็นอีเมลผู้ส่งที่ยืนยันไว้ในบัญชีแล้ว`,
      );
    }

    // โดเมนกลางของ Resend ใช้ได้เลยโดยไม่ต้องยืนยันโดเมนของตัวเอง
    // แต่ส่งได้เฉพาะไปยังอีเมลเจ้าของบัญชี Resend จนกว่าจะยืนยันโดเมน
    return 'onboarding@resend.dev';
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (this.provider === 'gmail') {
      // Apps Script ตอบ POST ด้วย 302 ไปหน้าผลลัพธ์ fetch ตามไปให้เอง
      const response = await fetch(this.gmailScriptUrl as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow',
        body: JSON.stringify({
          secret: this.gmailScriptSecret,
          to,
          subject,
          html,
          name: this.configService.get<string>('FROM_NAME') || 'Document Internship',
        }),
      });

      const text = await response.text();
      let result: { ok?: boolean; error?: string } = {};
      try {
        result = JSON.parse(text);
      } catch {
        // ได้หน้า HTML กลับมา มักเป็นเพราะ deploy สคริปต์ไม่ได้ตั้งให้ Anyone เข้าถึงได้
      }

      if (!response.ok || !result.ok) {
        throw new Error(`Gmail script ไม่ได้ส่ง (${response.status}): ${result.error ?? text.slice(0, 200)}`);
      }

      return;
    }

    if (this.provider === 'brevo') {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.brevoApiKey as string,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: {
            email: this.fromAddress(),
            name: this.configService.get<string>('FROM_NAME') || 'Document Internship',
          },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });

      if (!response.ok) {
        // Brevo บอกสาเหตุตรง ๆ เช่น ผู้ส่งยังไม่ยืนยัน หรือ API key ผิด
        const detail = await response.text();
        throw new Error(`Brevo ตอบ ${response.status}: ${detail}`);
      }

      return;
    }

    if (this.provider === 'mailjet') {
      const credentials = Buffer.from(
        `${this.mailjetApiKey}:${this.mailjetSecretKey}`,
      ).toString('base64');

      const response = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Messages: [
            {
              From: { Email: this.fromAddress() },
              To: [{ Email: to }],
              Subject: subject,
              HTMLPart: html,
            },
          ],
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Mailjet ตอบ ${response.status}: ${detail}`);
      }

      // v3.1 ตอบ 200 ได้ทั้งที่ฉบับนั้นไม่ได้ส่ง ต้องดู Status รายฉบับด้วย
      const payload = (await response.json()) as {
        Messages?: { Status?: string }[];
      };
      const status = payload.Messages?.[0]?.Status;

      if (status !== 'success') {
        throw new Error(`Mailjet ไม่ได้ส่ง: ${JSON.stringify(payload)}`);
      }

      return;
    }

    if (this.provider === 'resend') {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress(),
          to: [to],
          subject,
          html,
        }),
      });

      if (!response.ok) {
        // ข้อความจาก Resend บอกสาเหตุตรง ๆ เช่นโดเมนยังไม่ยืนยัน
        const detail = await response.text();
        throw new Error(`Resend ตอบ ${response.status}: ${detail}`);
      }

      return;
    }

    if (!this.transporter) {
      throw new Error(
        'ยังไม่ได้ตั้งค่าการส่งเมล ตั้ง GMAIL_SCRIPT_URL คู่กับ GMAIL_SCRIPT_SECRET, BREVO_API_KEY, MAILJET_API_KEY คู่กับ MAILJET_SECRET_KEY, RESEND_API_KEY หรือค่า SMTP_* อย่างใดอย่างหนึ่ง',
      );
    }

    await this.transporter.sendMail({
      from: this.fromAddress(),
      to,
      subject,
      html,
    });
  }

  async sendResetOtpMail(to: string, otp: string) {
    await this.send(
      to,
      'รหัส OTP สำหรับรีเซ็ตรหัสผ่านของคุณ',
      `
      <p>สวัสดีครับ</p>
      <p>มีคำขอให้รีเซ็ตรหัสผ่านบัญชีของคุณ</p>
      <p>รหัส OTP สำหรับรีเซ็ตรหัสของคุณคือ:</p>
      <h2>${otp}</h2>
      <p>รหัสนี้จะหมดอายุใน 10 นาที กรุณาอย่าเปิดเผยรหัสนี้ให้ผู้อื่นทราบ</p>
    `,
    );
  }

  // admin ตอบเรื่องที่แจ้งผ่านหน้า support
  async sendSupportReply(to: string, name: string, question: string, answer: string) {
    const esc = (s: string) =>
      s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    const lines = (s: string) => esc(s).replace(/\n/g, '<br>');

    await this.send(
      to,
      'ตอบกลับเรื่องที่คุณแจ้งไว้ในระบบ Document Internship',
      `
        <p>สวัสดีครับ คุณ${esc(name)}</p>
        <p>${lines(answer)}</p>
        <hr>
        <p style="color:#666">เรื่องที่คุณแจ้งไว้:<br>${lines(question)}</p>
      `,
    );
  }

  // admin อนุมัติแล้ว ส่งลิงก์เข้าสู่ระบบครั้งเดียวไปให้ กดแล้วเข้าระบบได้เลย
  async sendApprovedMail(to: string, link: string) {
    await this.send(
      to,
      'บัญชีของคุณได้รับการอนุมัติแล้ว',
      `
        <p>สวัสดีครับ</p>
        <p>ผู้ดูแลระบบอนุมัติบัญชีของคุณแล้ว กดลิงก์ด้านล่างเพื่อเข้าสู่ระบบได้ทันที</p>
        <p><a href="${link}">เข้าสู่ระบบ</a></p>
        <p>ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุใน 48 ชั่วโมง หลังจากนั้นเข้าสู่ระบบด้วยอีเมลและรหัสผ่านตามปกติ</p>
      `,
    );
  }

  // เมลยืนยันตอนสมัคร ต้องกดลิงก์นี้ก่อนถึงจะ login ได้
  async sendVerifyMail(to: string, link: string) {
    await this.send(
      to,
      'ยืนยันอีเมลเพื่อเปิดใช้งานบัญชีของคุณ',
      `
        <p>สวัสดีครับ</p>
        <p>มีการสมัครบัญชีด้วยอีเมลนี้ กรุณากดลิงก์ด้านล่างเพื่อยืนยัน</p>
        <p><a href="${link}">ยืนยันอีเมลของฉัน</a></p>
        <p>ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง</p>
        <p>หลังยืนยันแล้ว บัญชีจะอยู่ในสถานะรอผู้ดูแลระบบอนุมัติอีกขั้นหนึ่ง</p>
        <p>ถ้าคุณไม่ได้สมัคร ไม่ต้องทำอะไรกับอีเมลฉบับนี้</p>
      `,
    );
  }
}
