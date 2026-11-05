// ด่านยืนยันอีเมลเคยเทียบ isVerified กับ false ตรงตัว
// บัญชีเก่าไม่มีฟิลด์นี้ ค่าที่อ่านได้คือ undefined ซึ่งไม่เท่ากับ false
// บัญชีพวกนั้นจึงข้ามการยืนยันอีเมลไปได้ทั้งหมด ซึ่งคือช่องที่ต้องปิด
import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { AccountStatus, UserRole } from '../user/schema/user.schema';

describe('ด่าน login กับบัญชีที่ไม่มีฟิลด์ isVerified', () => {
  const password = 'secret123';
  let hash: string;

  const build = (user: any) =>
    new AuthService(
      { findByEmail: jest.fn().mockResolvedValue(user) } as any,
      { sign: () => 'token' } as any,
      { get: () => undefined } as any,
      { sendResetOtpMail: jest.fn(), sendVerifyMail: jest.fn() } as any,
    );

  beforeAll(async () => {
    hash = await bcrypt.hash(password, 10);
  });

  it('บัญชีเก่าที่ไม่มี isVerified ต้องถูกกั้นไว้', async () => {
    const service = build({
      email: 'legacy@mail.kmutt.ac.th',
      password: hash,
      role: UserRole.USER,
      status: AccountStatus.APPROVED,
    });

    await expect(
      service.validateUser('legacy@mail.kmutt.ac.th', password),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ข้อความที่ได้ต้องบอกให้ยืนยันอีเมล ไม่ใช่บอกว่ารออนุมัติ', async () => {
    const service = build({
      email: 'legacy@mail.kmutt.ac.th',
      password: hash,
      role: UserRole.USER,
      status: AccountStatus.APPROVED,
    });

    await expect(
      service.validateUser('legacy@mail.kmutt.ac.th', password),
    ).rejects.toThrow(/ยืนยันอีเมล/);
  });

  it('isVerified เป็น false ก็ยังถูกกั้นเหมือนเดิม', async () => {
    const service = build({
      email: 'new@mail.kmutt.ac.th',
      password: hash,
      role: UserRole.USER,
      isVerified: false,
      status: AccountStatus.APPROVED,
    });

    await expect(
      service.validateUser('new@mail.kmutt.ac.th', password),
    ).rejects.toThrow(/ยืนยันอีเมล/);
  });

  it('ยืนยันแล้วและอนุมัติแล้วยังเข้าได้ปกติ', async () => {
    const service = build({
      email: 'ok@mail.kmutt.ac.th',
      password: hash,
      role: UserRole.USER,
      isVerified: true,
      status: AccountStatus.APPROVED,
    });

    const user = await service.validateUser('ok@mail.kmutt.ac.th', password);

    expect(user.email).toBe('ok@mail.kmutt.ac.th');
  });

  it('ADMIN เก่าที่ไม่มีฟิลด์นี้ยังเข้าได้ เพราะข้ามด่านทั้งหมด', async () => {
    const service = build({
      email: 'admin@mail.kmutt.ac.th',
      password: hash,
      role: UserRole.ADMIN,
    });

    const user = await service.validateAdmin(
      'admin@mail.kmutt.ac.th',
      password,
    );

    expect(user.role).toBe(UserRole.ADMIN);
  });

  it('รหัสผ่านผิดยังคืน null ไม่ใช่โยน error', async () => {
    const service = build({
      email: 'ok@mail.kmutt.ac.th',
      password: hash,
      role: UserRole.USER,
      isVerified: true,
      status: AccountStatus.APPROVED,
    });

    await expect(
      service.validateUser('ok@mail.kmutt.ac.th', 'wrong-password'),
    ).resolves.toBeNull();
  });
});
