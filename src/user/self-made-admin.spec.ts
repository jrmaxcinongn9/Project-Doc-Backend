// เส้นสมัครเปิดให้ทุกคนเรียก เพราะนักศึกษาต้องสมัครเองได้
// แต่เดิมมันรับฟิลด์ role จาก body แล้วส่งต่อให้ฐานข้อมูลตรง ๆ
// ใครก็ได้จึงสมัครเป็น ADMIN ให้ตัวเอง และด่าน login ปล่อย ADMIN ผ่านทุกด่าน
import { UserController } from './user.controller';
import { UserRole } from './schema/user.schema';

describe('role ที่ส่งมากับการสมัคร', () => {
  let create: jest.Mock;
  let controller: UserController;

  beforeEach(() => {
    create = jest.fn().mockResolvedValue({ _id: 'u1' });

    controller = new UserController(
      { create, sendVerifyMail: jest.fn().mockResolvedValue('link') } as any,
      { get: () => undefined } as any,
    );

    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const roleUsed = () => create.mock.calls[0][0].role;

  it('คนนอกขอเป็น ADMIN ต้องได้ USER แทน', async () => {
    await controller.register({ role: UserRole.ADMIN } as any, {} as any);

    expect(roleUsed()).toBe(UserRole.USER);
  });

  it('คนนอกขอเป็น TEACHER ต้องได้ USER แทน', async () => {
    await controller.register({ role: UserRole.TEACHER } as any, {} as any);

    expect(roleUsed()).toBe(UserRole.USER);
  });

  it('นักศึกษาที่ login แล้วก็ยกระดับตัวเองไม่ได้', async () => {
    await controller.register({ role: UserRole.ADMIN } as any, {
      user: { role: UserRole.USER },
    } as any);

    expect(roleUsed()).toBe(UserRole.USER);
  });

  it('ครูที่ login แล้วก็สร้าง ADMIN ไม่ได้', async () => {
    await controller.register({ role: UserRole.ADMIN } as any, {
      user: { role: UserRole.TEACHER },
    } as any);

    expect(roleUsed()).toBe(UserRole.USER);
  });

  it('สมัครปกติไม่ส่ง role มาเลย ได้ USER', async () => {
    await controller.register({} as any, {} as any);

    expect(roleUsed()).toBe(UserRole.USER);
  });

  it('admin ที่ login แล้วสร้างบัญชีครูได้ตามเดิม', async () => {
    await controller.register({ role: UserRole.TEACHER } as any, {
      user: { role: UserRole.ADMIN },
    } as any);

    expect(roleUsed()).toBe(UserRole.TEACHER);
  });

  it('ข้อมูลอื่นที่ส่งมายังถูกส่งต่อครบ', async () => {
    await controller.register(
      { name: 'Student One', email: 'a@mail.kmutt.ac.th', category: 'SOFTWARE' } as any,
      {} as any,
    );

    expect(create.mock.calls[0][0]).toMatchObject({
      name: 'Student One',
      email: 'a@mail.kmutt.ac.th',
      category: 'SOFTWARE',
    });
  });
});
