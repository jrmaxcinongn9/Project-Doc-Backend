// ลิงก์ยืนยันที่ได้ตอนสมัครโชว์รอบเดียว
// รีเฟรชหรือกดย้อนกลับแล้วหายถาวร เหลือทางเดียวคือรบกวน admin
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { UserController } from './user.controller';

describe('ขอลิงก์ยืนยันใหม่ด้วยตัวเอง', () => {
  const password = 'secret123';
  let hash: string;
  let userService: any;

  beforeAll(async () => {
    hash = await bcrypt.hash(password, 10);
  });

  beforeEach(() => {
    userService = {
      findByEmail: jest.fn(),
      sendVerifyMail: jest.fn().mockResolvedValue('https://app/verify-email?token=new'),
    };
  });

  const controller = (expose?: string) =>
    new UserController(userService, {
      get: () => expose,
    } as any);

  const unverified = {
    _id: 'u1',
    email: 'student@mail.kmutt.ac.th',
    password: () => hash,
    isVerified: false,
  };

  const give = (over: any = {}) =>
    userService.findByEmail.mockResolvedValue({
      ...unverified,
      password: hash,
      ...over,
    });

  it('รหัสผ่านถูก ได้ลิงก์ใหม่', async () => {
    give();

    const result: any = await controller('true').resendVerifyMine({
      email: 'student@mail.kmutt.ac.th',
      password,
    });

    expect(result.verifyLink).toBe('https://app/verify-email?token=new');
  });

  it('รหัสผ่านผิด ไม่ได้ลิงก์', async () => {
    give();

    await expect(
      controller('true').resendVerifyMine({
        email: 'student@mail.kmutt.ac.th',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('ไม่มีบัญชีนี้ ตอบเหมือนรหัสผ่านผิด ไม่บอกว่ามีบัญชีไหม', async () => {
    userService.findByEmail.mockResolvedValue(null);

    await expect(
      controller('true').resendVerifyMine({
        email: 'nobody@mail.kmutt.ac.th',
        password,
      }),
    ).rejects.toThrow(/อีเมลหรือรหัสผ่านไม่ถูกต้อง/);
  });

  it('ไม่มีบัญชีนี้ ต้องไม่ไปสร้างลิงก์', async () => {
    userService.findByEmail.mockResolvedValue(null);

    await controller('true')
      .resendVerifyMine({ email: 'nobody@mail.kmutt.ac.th', password })
      .catch(() => undefined);

    expect(userService.sendVerifyMail).not.toHaveBeenCalled();
  });

  it('บัญชีที่ยืนยันแล้ว ไม่ออกลิงก์ใหม่', async () => {
    give({ isVerified: true });

    const result: any = await controller('true').resendVerifyMine({
      email: 'student@mail.kmutt.ac.th',
      password,
    });

    expect(result.alreadyVerified).toBe(true);
    expect(result.verifyLink).toBeUndefined();
    expect(userService.sendVerifyMail).not.toHaveBeenCalled();
  });

  it('ไม่เปิด EXPOSE_VERIFY_LINK ไม่คืนลิงก์ แต่ยังสร้างและส่งเมลให้', async () => {
    give();

    const result: any = await controller(undefined).resendVerifyMine({
      email: 'student@mail.kmutt.ac.th',
      password,
    });

    expect(result.verifyLink).toBeUndefined();
    expect(userService.sendVerifyMail).toHaveBeenCalled();
  });

  it('บอกด้วยว่าลิงก์ในเมลฉบับก่อนยังใช้ได้', async () => {
    give();

    const result: any = await controller('true').resendVerifyMine({
      email: 'student@mail.kmutt.ac.th',
      password,
    });

    expect(result.message).toMatch(/ลิงก์ในเมลฉบับก่อนยังใช้ได้/);
  });
});
