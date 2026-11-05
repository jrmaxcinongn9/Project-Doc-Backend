// บัญชีที่สมัครไว้ก่อนมีฟิลด์ status จะไม่มีคีย์ status ในเอกสารเลย
// ด่าน login ปิดกั้นบัญชีพวกนั้นว่า "รออนุมัติ" แต่ตัวกรองเดิมมองไม่เห็น
// ผลคือบัญชีค้างอยู่กลางทาง เข้าระบบไม่ได้และไม่มีใครกดอนุมัติให้ได้
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { UserService } from './user.service';
import { AccountStatus, User, UserRole } from './schema/user.schema';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';

describe('findPending กับบัญชีที่ไม่มีฟิลด์ status', () => {
  let service: UserService;
  let lastFilter: any;

  const docs = [
    { email: 'new@mail.kmutt.ac.th', status: AccountStatus.PENDING },
    { email: 'legacy@mail.kmutt.ac.th' },
  ];

  beforeEach(async () => {
    lastFilter = undefined;

    const model = {
      find: jest.fn((filter: any) => {
        lastFilter = filter;
        return {
          select: () => ({ exec: () => Promise.resolve(docs) }),
        };
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getModelToken(User.name), useValue: model },
        { provide: MailService, useValue: { sendVerifyMail: jest.fn() } },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = moduleRef.get(UserService);
  });

  it('คืนค่าได้ทั้งบัญชีใหม่และบัญชีเก่า', async () => {
    const result = await service.findPending();

    expect(result).toHaveLength(2);
  });

  it('ตัวกรองนับ status ที่เป็น PENDING', async () => {
    await service.findPending();

    expect(lastFilter.$or).toContainEqual({ status: AccountStatus.PENDING });
  });

  it('ตัวกรองนับเอกสารที่ไม่มีคีย์ status', async () => {
    await service.findPending();

    expect(lastFilter.$or).toContainEqual({ status: { $exists: false } });
  });

  it('ตัวกรองนับ status ที่เป็น null', async () => {
    await service.findPending();

    expect(lastFilter.$or).toContainEqual({ status: null });
  });

  it('ตัดบัญชี ADMIN ออก เพราะข้ามด่านอนุมัติอยู่แล้ว', async () => {
    await service.findPending();

    expect(lastFilter.role).toEqual({ $ne: UserRole.ADMIN });
  });

  it('ไม่กรองด้วย status แบบเท่ากับค่าเดียวที่ระดับบนสุด', async () => {
    await service.findPending();

    // ตัวกรองเดิมเป็น { status: 'PENDING' } ตรง ๆ ซึ่งคือต้นเหตุของบั๊ก
    expect(lastFilter.status).toBeUndefined();
  });
});
