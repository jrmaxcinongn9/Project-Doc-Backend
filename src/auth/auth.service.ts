// src/auth/auth.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { randomInt } from 'crypto';

import { UserService } from '../user/user.service';
import { UserRole } from '../user/schema/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  // ✅ ใช้กับ LocalStrategy (/auth/login)
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return user;
  }

  // ✅ admin login → users collection + role ADMIN
  async validateAdmin(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    if (user.role !== UserRole.ADMIN) return null;

    return user;
  }

  // ✅ teacher login → users collection + role TEACHER
  async validateTeacher(email: string, password: string) {
  const user = await this.userService.findByEmail(email);
  if (!user) return null;
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return null;
  if (user.role !== UserRole.TEACHER) return null;
  return user;
}

  // ✅ สร้าง JWT ใช้ได้กับทุก role
  async login(user: any) {
    const id = user._id?.toString?.() ?? user.id;

    const payload = {
      sub: id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  // 🔹 ขอ OTP reset password
  async generateResetOtp(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);

    // ป้องกันไม่ให้เดาว่ามี email นี้ไหม
    if (!user) {
      return;
    }

    const otp = randomInt(100000, 999999).toString();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 10);

    (user as any).resetOtp = otp;
    (user as any).resetOtpExpires = expires;
    await user.save();

    await this.mailService.sendResetOtpMail(user.email, otp);
  }

  // 🔹 ใช้ OTP reset password
  async resetPasswordWithOtp(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { resetOtp, resetOtpExpires } = user as any;

    if (!resetOtp || !resetOtpExpires) {
      throw new BadRequestException('OTP not requested or already used');
    }

    const now = new Date();
    if (resetOtp !== otp || resetOtpExpires.getTime() < now.getTime()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    }

    user.password = newPassword;
    (user as any).resetOtp = undefined;
    (user as any).resetOtpExpires = undefined;

    await user.save();
  }

  // 🔹 ดึง users แยกตาม role
  async getAllRoles() {
    const all = await this.userService.findAll();

    const users = all.filter((u) => u.role === UserRole.USER);
    const admins = all.filter((u) => u.role === UserRole.ADMIN);
    const teachers = all.filter((u) => u.role === UserRole.TEACHER);

    return { users, admins, teachers };
  }
}
