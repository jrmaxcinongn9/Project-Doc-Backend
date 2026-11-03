// src/mail/mail.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * ส่งเมลได้สองทาง
 *
 * ตั้ง RESEND_API_KEY ไว้ จะส่งผ่าน HTTPS API ของ Resend
 * ทางนี้จำเป็นบนโฮสต์อย่าง Render free tier ที่บล็อกพอร์ต SMTP ขาออก
 * ทุกพอร์ต ทั้ง 587 และ 465 ต่อไม่ติดเหมือนกัน แต่ 443 ออกได้ปกติ
 *
 * ไม่ตั้ง จะถอยไปใช้ SMTP ผ่าน nodemailer เหมือนเดิม
 * ซึ่งยังสะดวกกว่าตอนพัฒนาบนเครื่องตัวเอง
 */
@Injectable()
export class MailService {
  private transporter?: nodemailer.Transporter;
  private readonly resendApiKey?: string;

  constructor(private readonly configService: ConfigService) {
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY');

    if (this.resendApiKey) {
      console.log('==== MAIL: Resend HTTPS API ====');
      console.log('FROM_EMAIL =', this.fromAddress());
      console.log('================================');
      return;
    }

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
          'ส่งเมลจะไม่ทำงานจนกว่าจะแก้ ถ้าโฮสต์บล็อกพอร์ต SMTP ให้ตั้ง RESEND_API_KEY แทน',
        );
      } else {
        console.log('SMTP server is ready to take messages');
      }
    });
  }

  private fromAddress(): string {
    return (
      this.configService.get<string>('FROM_EMAIL') ||
      this.configService.get<string>('SMTP_USER') ||
      // โดเมนกลางของ Resend ใช้ได้เลยโดยไม่ต้องยืนยันโดเมนของตัวเอง
      // แต่ส่งได้เฉพาะไปยังอีเมลเจ้าของบัญชี Resend จนกว่าจะยืนยันโดเมน
      'onboarding@resend.dev'
    );
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (this.resendApiKey) {
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
        'ยังไม่ได้ตั้งค่าการส่งเมล ตั้ง RESEND_API_KEY หรือค่า SMTP_* อย่างใดอย่างหนึ่ง',
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
