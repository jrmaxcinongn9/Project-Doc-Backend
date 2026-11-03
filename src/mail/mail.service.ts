// src/mail/mail.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<string>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    const portNumber = Number(port) || 587;

    // พอร์ต 465 คุยกันด้วย TLS ตั้งแต่วินาทีแรก ต้อง secure เป็น true
    // ส่วน 587 เริ่มแบบ plain แล้วค่อยยกระดับด้วย STARTTLS จึงต้องเป็น false
    // ตั้ง SMTP_SECURE ทับได้ถ้าผู้ให้บริการใช้กติกาอื่น
    const secureSetting = this.configService.get<string>('SMTP_SECURE');
    const secure =
      secureSetting !== undefined
        ? secureSetting === 'true'
        : portNumber === 465;

    console.log('==== SMTP CONFIG ====');
    console.log('SMTP_HOST =', host);
    console.log('SMTP_PORT =', portNumber);
    console.log('SMTP_SECURE =', secure);
    console.log('SMTP_USER =', user);
    console.log('SMTP_PASS =', pass ? '***' : undefined);
    console.log('=====================');

    // เตือนตั้งแต่ตอน boot ถ้าค่าที่ได้มาไม่ใช่อีเมล
    // เคยมีเคสวาง placeholder ลงไปตรง ๆ แล้วไปรู้ตัวตอนส่งเมลไม่ออก
    if (user && !user.includes('@')) {
      console.error(
        `SMTP_USER ไม่ใช่อีเมล ได้ค่ามาเป็น "${user}" กรุณาตั้งเป็นอีเมลที่ใช้ส่งจริง`,
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: portNumber,
      secure,
      auth: {
        user,
        pass,
      },
      // ไม่ให้ค้างยาวเมื่อผู้ให้บริการบล็อกพอร์ตขาออก
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });

    // ทดสอบ connect ทันที (ช่วยบอกว่าปัญหาอยู่ที่ไหน)
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('SMTP verify error:', error);
        console.error(
          'ส่งเมลยืนยันจะไม่ทำงานจนกว่าจะแก้ ตรวจ SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS',
        );
      } else {
        console.log('SMTP server is ready to take messages');
      }
    });
  }

 async sendResetOtpMail(to: string, otp: string) {
  const from =
    this.configService.get<string>('FROM_EMAIL') ||
    this.configService.get<string>('SMTP_USER') ||
    'noreply@example.com';

  await this.transporter.sendMail({
    from,
    to,
    subject: 'รหัส OTP สำหรับรีเซ็ตรหัสผ่านของคุณ',
    html: `
      <p>สวัสดีครับ</p>
      <p>มีคำขอให้รีเซ็ตรหัสผ่านบัญชีของคุณ</p>
      <p>รหัส OTP สำหรับรีเซ็ตรหัสของคุณคือ:</p>
      <h2>${otp}</h2>
      <p>รหัสนี้จะหมดอายุใน 10 นาที กรุณาอย่าเปิดเผยรหัสนี้ให้ผู้อื่นทราบ</p>
    `,
  });
}

  // เมลยืนยันตอนสมัคร ต้องกดลิงก์นี้ก่อนถึงจะ login ได้
  async sendVerifyMail(to: string, link: string) {
    const from =
      this.configService.get<string>('FROM_EMAIL') ||
      this.configService.get<string>('SMTP_USER') ||
      'noreply@example.com';

    await this.transporter.sendMail({
      from,
      to,
      subject: 'ยืนยันอีเมลเพื่อเปิดใช้งานบัญชีของคุณ',
      html: `
        <p>สวัสดีครับ</p>
        <p>มีการสมัครบัญชีด้วยอีเมลนี้ กรุณากดลิงก์ด้านล่างเพื่อยืนยัน</p>
        <p><a href="${link}">ยืนยันอีเมลของฉัน</a></p>
        <p>ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง</p>
        <p>หลังยืนยันแล้ว บัญชีจะอยู่ในสถานะรอผู้ดูแลระบบอนุมัติอีกขั้นหนึ่ง</p>
        <p>ถ้าคุณไม่ได้สมัคร ไม่ต้องทำอะไรกับอีเมลฉบับนี้</p>
      `,
    });
  }
}
