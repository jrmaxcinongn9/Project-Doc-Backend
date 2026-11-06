// ลิงก์ยืนยันหมดอายุ 24 ชั่วโมง และผู้ใช้ทำลิงก์หายได้
// ถ้าไม่มีทางขอใหม่ ทางออกเดียวคือให้ admin กดยืนยันแทน
// ซึ่งข้ามการพิสูจน์ว่าเจ้าของอีเมลนั้นมีตัวจริง
import { UserController } from './user.controller';

describe('POST :id/resend-verify', () => {
  const buildController = (sendVerifyMail: jest.Mock) =>
    new UserController(
      { sendVerifyMail } as any,
      { get: () => undefined } as any,
    );

  it('คืนลิงก์ยืนยันใหม่ออกมา', async () => {
    const link = 'https://example.test/verify-email?token=abc';
    const controller = buildController(jest.fn().mockResolvedValue(link));

    const result: any = await controller.resendVerify('user-1');

    expect(result.verifyLink).toBe(link);
  });

  it('ส่ง id ที่รับมาต่อให้ service ตรงตัว', async () => {
    const sendVerifyMail = jest.fn().mockResolvedValue('link');
    const controller = buildController(sendVerifyMail);

    await controller.resendVerify('user-42');

    expect(sendVerifyMail).toHaveBeenCalledWith('user-42');
  });

  it('คืนลิงก์โดยไม่ต้องพึ่ง EXPOSE_VERIFY_LINK เพราะเส้นนี้จำกัดเฉพาะ admin', async () => {
    const controller = new UserController(
      { sendVerifyMail: jest.fn().mockResolvedValue('link') } as any,
      { get: () => 'false' } as any,
    );

    const result: any = await controller.resendVerify('user-1');

    expect(result.verifyLink).toBe('link');
  });

  // ส่งซ้ำใช้รหัสเดิม ลิงก์ในเมลฉบับก่อนจึงยังใช้ได้
  it('บอกว่าลิงก์ในเมลฉบับก่อนยังใช้ได้', async () => {
    const controller = buildController(jest.fn().mockResolvedValue('link'));

    const result: any = await controller.resendVerify('user-1');

    expect(result.message).toMatch(/ลิงก์ในเมลฉบับก่อนยังใช้ได้/);
  });

  it('บัญชีไม่มีอยู่ ปล่อย error ของ service ขึ้นไปตามเดิม', async () => {
    const controller = buildController(
      jest.fn().mockRejectedValue(new Error('User not found')),
    );

    await expect(controller.resendVerify('ไม่มี')).rejects.toThrow(
      'User not found',
    );
  });
});
