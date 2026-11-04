import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { UserService } from './user.service';
import { MailService } from '../mail/mail.service';
import { User } from './schema/user.schema';

/**
 * ลิงก์ยืนยันถูกบันทึกลงฐานข้อมูลก่อนส่งเมลเสมอ จึงใช้งานได้แม้เมลส่งไม่ออก
 * และกรณีที่เมลส่งไม่ออกคือกรณีที่ต้องหยิบลิงก์มาใช้มือพอดี
 * ถ้าปล่อยให้ error ของเมลล้มทั้งฟังก์ชัน ผู้เรียกจะไม่ได้ลิงก์ไปด้วย
 */
describe('ลิงก์ยืนยันต้องรอดแม้ส่งเมลล้ม', () => {
  let service: UserService;
  let sendVerifyMail: jest.Mock;
  let saved: any;

  beforeEach(async () => {
    sendVerifyMail = jest.fn().mockResolvedValue(undefined);

    saved = {
      email: 'student@mail.kmutt.ac.th',
      save: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findById: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(saved),
            }),
          },
        },
        { provide: MailService, useValue: { sendVerifyMail } },
        {
          provide: ConfigService,
          useValue: { get: () => 'https://app.example.com' },
        },
      ],
    }).compile();

    service = moduleRef.get(UserService);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('คืนลิงก์เมื่อส่งเมลสำเร็จ', async () => {
    const link = await service.sendVerifyMail('u1');

    expect(link).toContain('https://app.example.com/verify-email?token=');
    expect(sendVerifyMail).toHaveBeenCalled();
  });

  it('ยังคืนลิงก์เมื่อส่งเมลล้ม', async () => {
    sendVerifyMail.mockRejectedValue(new Error('Mailjet ตอบ 401'));

    const link = await service.sendVerifyMail('u1');

    expect(link).toContain('https://app.example.com/verify-email?token=');
  });

  it('token ถูกบันทึกก่อน จึงใช้ลิงก์ได้จริงแม้เมลล้ม', async () => {
    sendVerifyMail.mockRejectedValue(new Error('Mailjet ตอบ 401'));

    const link = await service.sendVerifyMail('u1');
    const token = new URL(link).searchParams.get('token');

    expect(saved.save).toHaveBeenCalled();
    expect(saved.verifyToken).toBe(token);
  });

  it('เมลล้มแล้วต้องไม่โยน error ออกไป', async () => {
    sendVerifyMail.mockRejectedValue(new Error('Mailjet ตอบ 401'));

    await expect(service.sendVerifyMail('u1')).resolves.toBeDefined();
  });
});
