import { UserController } from './user.controller';

/**
 * เมลยืนยันส่งไม่ถึงได้ด้วยเหตุที่ผู้ใช้แก้เองไม่ได้
 * ทั้งผู้ให้บริการเมลระงับบัญชี กล่องปลายทางคัดเป็นสแปม หรือโดเมนยังไม่ยืนยัน
 * ระบบจึงต้องมีทางให้ admin ยืนยันแทน และมีทางหยิบลิงก์มาใช้ตอนสาธิต
 */
function configWith(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as any;
}

describe('ยืนยันอีเมลเมื่อส่งเมลไม่ได้', () => {
  let userService: any;

  beforeEach(() => {
    userService = {
      create: jest.fn().mockResolvedValue({ _id: 'u1', email: 'a@mail.kmutt.ac.th' }),
      sendVerifyMail: jest.fn().mockResolvedValue('https://app/verify-email?token=abc'),
      markVerifiedByAdmin: jest.fn().mockResolvedValue({ isVerified: true }),
    };
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('ลิงก์ยืนยันใน response ของการสมัคร', () => {
    it('ไม่คืนลิงก์ออกมาเมื่อไม่ได้เปิดไว้', async () => {
      const controller = new UserController(userService, configWith({}));

      const result: any = await controller.register({} as any);

      expect(result.verifyLink).toBeUndefined();
    });

    it('ไม่คืนลิงก์เมื่อตั้งค่าเป็นค่าอื่นที่ไม่ใช่ true', async () => {
      const controller = new UserController(
        userService,
        configWith({ EXPOSE_VERIFY_LINK: 'yes' }),
      );

      const result: any = await controller.register({} as any);

      expect(result.verifyLink).toBeUndefined();
    });

    it('คืนลิงก์เมื่อเปิดไว้ชัดเจน', async () => {
      const controller = new UserController(
        userService,
        configWith({ EXPOSE_VERIFY_LINK: 'true' }),
      );

      const result: any = await controller.register({} as any);

      expect(result.verifyLink).toBe('https://app/verify-email?token=abc');
    });

    it('ส่งเมลล้มแล้วการสมัครต้องไม่ล้มตาม และไม่มีลิงก์ให้คืน', async () => {
      userService.sendVerifyMail.mockRejectedValue(new Error('mail down'));

      const controller = new UserController(
        userService,
        configWith({ EXPOSE_VERIFY_LINK: 'true' }),
      );

      const result: any = await controller.register({} as any);

      expect(result.verifyLink).toBeUndefined();
      expect(result.message).toContain('สมัครสำเร็จ');
    });
  });

  describe('admin ยืนยันแทนผู้ใช้', () => {
    it('ส่ง id กับอีเมลของ admin ที่กดไปให้ service', async () => {
      const controller = new UserController(userService, configWith({}));

      await controller.verifyEmailByAdmin('u9', {
        user: { email: 'admin@mail.kmutt.ac.th' },
      } as any);

      expect(userService.markVerifiedByAdmin).toHaveBeenCalledWith(
        'u9',
        'admin@mail.kmutt.ac.th',
      );
    });

    it('ไม่มีข้อมูลผู้กดก็ยังทำงานได้', async () => {
      const controller = new UserController(userService, configWith({}));

      await controller.verifyEmailByAdmin('u9', {} as any);

      expect(userService.markVerifiedByAdmin).toHaveBeenCalledWith(
        'u9',
        undefined,
      );
    });
  });
});
