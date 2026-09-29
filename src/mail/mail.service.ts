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

    console.log('==== SMTP CONFIG ====');
    console.log('SMTP_HOST =', host);
    console.log('SMTP_PORT =', port);
    console.log('SMTP_USER =', user);
    console.log('SMTP_PASS =', pass);
    console.log('=====================');

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: false,
      auth: {
        user,
        pass,
      },
    });

    // ทดสอบ connect ทันที (ช่วยบอกว่าปัญหาอยู่ที่ไหน)
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('SMTP verify error:', error);
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
}
