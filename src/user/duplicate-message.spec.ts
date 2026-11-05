// สร้างบัญชีครูแล้วได้ Duplicate data detected ทั้งที่อีเมลไม่ซ้ำ
// สาเหตุจริงคือ index ของ student_id ในฐานข้อมูลยังไม่ใช่ sparse
// เอกสารที่ไม่มีรหัสนักศึกษาจึงถูกนับว่า null เท่ากันหมดและชนกันเอง
// ข้อความเดิมไม่บอกอะไรเลย ไล่หาสาเหตุกันนาน
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

import { UserService } from './user.service';
import { User } from './schema/user.schema';
import { MailService } from '../mail/mail.service';

describe('ข้อความตอนข้อมูลซ้ำ', () => {
  let service: UserService;
  let duplicateOn: string | undefined;

  beforeEach(async () => {
    duplicateOn = undefined;

    function FakeModel(this: any, data: any) {
      Object.assign(this, data);
      this.save = () => {
        const err: any = new Error('E11000');
        err.code = 11000;
        err.keyPattern = duplicateOn ? { [duplicateOn]: 1 } : undefined;
        return Promise.reject(err);
      };
    }

    (FakeModel as any).findOne = () => Promise.resolve(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getModelToken(User.name), useValue: FakeModel },
        { provide: MailService, useValue: { sendVerifyMail: jest.fn() } },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = moduleRef.get(UserService);
  });

  const create = () =>
    service.create({
      name: 'Teacher One',
      email: 'teacher@mail.kmutt.ac.th',
      password: 'secret123',
    });

  it('ชนที่ student_id ต้องบอกวิธีแก้', async () => {
    duplicateOn = 'student_id';

    await expect(create()).rejects.toThrow(/fix-student-id-index/);
  });

  it('ชนที่ student_id ต้องบอกด้วยว่าเกี่ยวกับบัญชีที่ไม่มีรหัสนักศึกษา', async () => {
    duplicateOn = 'student_id';

    await expect(create()).rejects.toThrow(/ไม่มีรหัสนักศึกษา/);
  });

  it('ชนที่ฟิลด์อื่นบอกชื่อฟิลด์', async () => {
    duplicateOn = 'email';

    await expect(create()).rejects.toThrow(/email/);
  });

  it('ไม่รู้ว่าชนที่ไหน ยังตอบแบบเดิม', async () => {
    duplicateOn = undefined;

    await expect(create()).rejects.toThrow('Duplicate data detected');
  });

  it('ยังเป็น BadRequest ไม่ใช่ error ดิบ', async () => {
    duplicateOn = 'student_id';

    await expect(create()).rejects.toBeInstanceOf(BadRequestException);
  });
});
