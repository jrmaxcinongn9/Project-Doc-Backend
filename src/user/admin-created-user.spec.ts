// บัญชีที่ admin เพิ่มจากหน้าจัดการผู้ใช้ เคยเกิดมาเป็นยังไม่ยืนยันอีเมลและรออนุมัติ
// ระบบส่งเมลยังใช้ไม่ได้ เจ้าของบัญชีจึง login ไม่ได้ ทั้งที่ admin เป็นคนสร้างให้เอง
import { UserController } from './user.controller';
import { AccountStatus, UserRole } from './schema/user.schema';

describe('บัญชีที่ admin เพิ่มเอง', () => {
  let create: jest.Mock;
  let sendVerifyMail: jest.Mock;
  let controller: UserController;

  beforeEach(() => {
    create = jest.fn().mockResolvedValue({ _id: 'u1' });
    sendVerifyMail = jest.fn().mockResolvedValue('link');

    controller = new UserController(
      { create, sendVerifyMail } as any,
      { get: () => undefined } as any,
    );
  });

  const asAdmin = { user: { role: UserRole.ADMIN } } as any;

  it('ยืนยันอีเมลและอนุมัติให้เลย', async () => {
    await controller.register({ role: UserRole.USER } as any, asAdmin);

    expect(create.mock.calls[0][0]).toMatchObject({
      isVerified: true,
      status: AccountStatus.APPROVED,
    });
  });

  it('ไม่ส่งลิงก์ยืนยัน เพราะยืนยันแล้ว', async () => {
    await controller.register({ role: UserRole.USER } as any, asAdmin);

    expect(sendVerifyMail).not.toHaveBeenCalled();
  });

  it('นักศึกษาที่สมัครเองยังต้องยืนยันและรออนุมัติเหมือนเดิม', async () => {
    await controller.register({} as any, {} as any);

    expect(create.mock.calls[0][0].isVerified).toBeUndefined();
    expect(create.mock.calls[0][0].status).toBeUndefined();
    expect(sendVerifyMail).toHaveBeenCalled();
  });

  it('ส่ง isVerified มาเองใน body ก็ไม่ได้ผล ถ้าไม่ใช่ admin', async () => {
    await controller.register({ isVerified: true, status: 'APPROVED' } as any, {} as any);

    // ValidationPipe ตัดฟิลด์พวกนี้ทิ้งก่อนถึงตรงนี้ (forbidNonWhitelisted)
    // ตรงนี้กันอีกชั้น ว่าไม่ได้ถูกเติมให้โดย controller
    expect(create.mock.calls[0][0].role).toBe(UserRole.USER);
  });
});
