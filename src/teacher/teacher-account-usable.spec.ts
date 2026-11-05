// บัญชีครูที่ admin สร้าง เคยเกิดมาเป็นยังไม่ยืนยันอีเมลและรออนุมัติ
// ครูจึง login ไม่ได้เลย และไม่มีใครส่งลิงก์ยืนยันให้ด้วย
// เท่ากับ admin สร้างบัญชีครูแล้วครูใช้ไม่ได้
import { TeacherService } from './teacher.service';
import { AccountStatus, UserRole } from '../user/schema/user.schema';

describe('บัญชีครูที่ admin สร้าง', () => {
  let create: jest.Mock;
  let service: TeacherService;

  beforeEach(() => {
    create = jest.fn().mockResolvedValue({ email: 'teacher@mail.kmutt.ac.th' });
    service = new TeacherService({ create } as any);
  });

  const make = () =>
    service.create({
      name: 'Teacher One',
      email: 'teacher@mail.kmutt.ac.th',
      password: 'secret123',
      category: 'SOFTWARE',
    });

  it('ยืนยันอีเมลให้เลย ไม่ต้องรอลิงก์ที่ไม่มีใครส่ง', async () => {
    await make();

    expect(create.mock.calls[0][0].isVerified).toBe(true);
  });

  it('อนุมัติให้เลย เพราะ admin ที่กดสร้างคือคนตรวจสอบ', async () => {
    await make();

    expect(create.mock.calls[0][0].status).toBe(AccountStatus.APPROVED);
  });

  it('ยังเป็น role TEACHER', async () => {
    await make();

    expect(create.mock.calls[0][0].role).toBe(UserRole.TEACHER);
  });

  it('สาขายังถูกส่งต่อไปด้วย เพราะใช้จับคู่กับนักศึกษา', async () => {
    await make();

    expect(create.mock.calls[0][0].category).toBe('SOFTWARE');
  });
});
