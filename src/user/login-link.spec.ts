// ยืนยันอีเมลผ่าน Gmail แล้วกดลิงก์เข้าสู่ระบบได้เลย
// นักศึกษาที่สมัครเองยังต้องรอ admin อนุมัติ (ข้อ 3) แล้วได้ลิงก์เข้าระบบทางเมลตอนอนุมัติ
import { UserService } from './user.service';
import { AccountStatus } from './schema/user.schema';
import { AuthController } from '../auth/auth.controller';

function makeUser(over: any = {}) {
  const u: any = {
    _id: 'u1',
    email: 'a@mail.kmutt.ac.th',
    name: 'A',
    role: 'USER',
    isVerified: false,
    status: AccountStatus.PENDING,
    verifyToken: 'v1',
    verifyTokenExpires: new Date(Date.now() + 3600_000),
    ...over,
  };
  u.save = jest.fn(async () => u);
  return u;
}

function serviceWith(user: any) {
  const model: any = {
    findOne: jest.fn(() => ({ exec: async () => user })),
    findById: jest.fn(() => ({ exec: async () => user })),
  };
  const mail = { sendApprovedMail: jest.fn().mockResolvedValue(undefined) };
  const config = { get: (k: string) => ({ FRONTEND_URL: 'https://web.test/' } as any)[k] };
  return { service: new UserService(model, mail as any, config as any), mail };
}

describe('ยืนยันอีเมลแล้วเข้าระบบ', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('บัญชีที่ยังรออนุมัติ ยืนยันได้ แต่ไม่ได้ลิงก์เข้าระบบ', async () => {
    const user = makeUser();
    const { service } = serviceWith(user);

    expect(await service.verifyEmail('v1')).toMatchObject({ approved: false, loginToken: null, already: false });
    expect(user.isVerified).toBe(true);
    expect(user.loginToken).toBeUndefined();
  });

  it('บัญชีที่อนุมัติแล้ว ยืนยันแล้วได้ลิงก์เข้าระบบทันที', async () => {
    const user = makeUser({ status: AccountStatus.APPROVED });
    const { service } = serviceWith(user);

    const r = await service.verifyEmail('v1');

    expect(r.approved).toBe(true);
    expect(r.loginToken).toMatch(/^[0-9a-f]{64}$/);
    expect(user.loginToken).toBe(r.loginToken);
  });

  it('admin อนุมัติบัญชีที่ยืนยันอีเมลแล้ว ส่งเมลพร้อมลิงก์เข้าระบบ', async () => {
    const user = makeUser({ isVerified: true });
    const { service, mail } = serviceWith(user);

    await service.setStatus('u1', AccountStatus.APPROVED, 'admin@x');

    expect(mail.sendApprovedMail).toHaveBeenCalledWith(
      'a@mail.kmutt.ac.th',
      expect.stringMatching(/^https:\/\/web\.test\/login\/magic\?token=[0-9a-f]{64}$/),
    );
  });

  it('อนุมัติบัญชีที่ยังไม่ยืนยันอีเมล ยังไม่ส่งลิงก์ รอให้ยืนยันก่อน', async () => {
    const { service, mail } = serviceWith(makeUser());

    await service.setStatus('u1', AccountStatus.APPROVED);

    expect(mail.sendApprovedMail).not.toHaveBeenCalled();
  });

  it('อนุมัติซ้ำบัญชีที่อนุมัติแล้ว ไม่ส่งเมลซ้ำ', async () => {
    const { service, mail } = serviceWith(makeUser({ isVerified: true, status: AccountStatus.APPROVED }));

    await service.setStatus('u1', AccountStatus.APPROVED);

    expect(mail.sendApprovedMail).not.toHaveBeenCalled();
  });

  it('ปฏิเสธบัญชี ไม่ส่งลิงก์', async () => {
    const { service, mail } = serviceWith(makeUser({ isVerified: true }));

    await service.setStatus('u1', AccountStatus.REJECTED);

    expect(mail.sendApprovedMail).not.toHaveBeenCalled();
  });

  it('ส่งเมลไม่สำเร็จ การอนุมัติยังสำเร็จ', async () => {
    const user = makeUser({ isVerified: true });
    const { service, mail } = serviceWith(user);
    mail.sendApprovedMail.mockRejectedValue(new Error('quota'));

    await expect(service.setStatus('u1', AccountStatus.APPROVED)).resolves.toBe(user);
    expect(user.status).toBe(AccountStatus.APPROVED);
  });

  it('admin ยืนยันอีเมลแทนบัญชีที่อนุมัติไปแล้ว ส่งลิงก์ตอนนั้น', async () => {
    const { service, mail } = serviceWith(makeUser({ status: AccountStatus.APPROVED }));

    await service.markVerifiedByAdmin('u1', 'admin@x');

    expect(mail.sendApprovedMail).toHaveBeenCalled();
  });
});

describe('ลิงก์ยืนยันในเมลใช้ได้ทุกฉบับ', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  function withMail(user: any) {
    const { service, mail } = serviceWith(user);
    (mail as any).sendVerifyMail = jest.fn().mockResolvedValue(undefined);
    return { service, mail: mail as any };
  }

  it('ส่งลิงก์ซ้ำ ใช้รหัสเดิมที่ยังไม่หมดอายุ', async () => {
    const user = makeUser({ verifyToken: 'v1', verifyTokenExpires: new Date(Date.now() + 20 * 3600_000) });
    const { service } = withMail(user);

    const link = await service.sendVerifyMail('u1');

    expect(link).toMatch(/token=v1$/);
    expect(user.verifyToken).toBe('v1');
  });

  it('รหัสเดิมใกล้หมดอายุ สร้างรหัสใหม่', async () => {
    const user = makeUser({ verifyToken: 'v1', verifyTokenExpires: new Date(Date.now() + 10 * 60_000) });
    const { service } = withMail(user);

    await service.sendVerifyMail('u1');

    expect(user.verifyToken).not.toBe('v1');
    expect(user.verifyToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('กดลิงก์ที่ยืนยันไปแล้วซ้ำ บอกว่ายืนยันแล้ว ไม่ใช่ผิดพลาด', async () => {
    const verified = makeUser({ isVerified: true, verifyToken: undefined, usedVerifyToken: 'v1' });
    const model: any = {
      findOne: jest.fn((q: any) => ({ exec: async () => (q.usedVerifyToken === 'v1' ? verified : null) })),
    };
    const service = new UserService(model, {} as any, { get: () => undefined } as any);

    await expect(service.verifyEmail('v1')).resolves.toMatchObject({ already: true, loginToken: null });
  });

  it('กดลิงก์ซ้ำ ไม่ได้ลิงก์เข้าระบบเพิ่ม', async () => {
    const verified = makeUser({ isVerified: true, status: AccountStatus.APPROVED, usedVerifyToken: 'v1' });
    const model: any = {
      findOne: jest.fn((q: any) => ({ exec: async () => (q.usedVerifyToken ? verified : null) })),
    };
    const service = new UserService(model, {} as any, { get: () => undefined } as any);

    const r = await service.verifyEmail('v1');

    expect(r.loginToken).toBeNull();
    expect(verified.loginToken).toBeUndefined();
  });

  it('ยืนยันแล้วจำรหัสที่ใช้ไว้', async () => {
    const user = makeUser();
    const { service } = serviceWith(user);

    await service.verifyEmail('v1');

    expect(user.usedVerifyToken).toBe('v1');
  });
});

describe('ลิงก์เข้าสู่ระบบครั้งเดียว', () => {
  it('ใช้ได้ครั้งเดียว ลบ token ทันที', async () => {
    const user = makeUser({ isVerified: true, status: AccountStatus.APPROVED, loginToken: 't', loginTokenExpires: new Date(Date.now() + 1000) });
    const { service } = serviceWith(user);

    await expect(service.consumeLoginToken('t')).resolves.toBe(user);
    expect(user.loginToken).toBeUndefined();
  });

  it('หมดอายุแล้วใช้ไม่ได้ และถูกลบทิ้ง', async () => {
    const user = makeUser({ isVerified: true, status: AccountStatus.APPROVED, loginToken: 't', loginTokenExpires: new Date(Date.now() - 1000) });
    const { service } = serviceWith(user);

    await expect(service.consumeLoginToken('t')).rejects.toThrow(/หมดอายุ/);
    expect(user.loginToken).toBeUndefined();
  });

  it('บัญชีที่ถูกปฏิเสธหลังได้ลิงก์ ใช้ลิงก์ไม่ได้', async () => {
    const user = makeUser({ isVerified: true, status: AccountStatus.REJECTED, loginToken: 't', loginTokenExpires: new Date(Date.now() + 1000) });
    const { service } = serviceWith(user);

    await expect(service.consumeLoginToken('t')).rejects.toThrow(/ไม่พร้อมใช้งาน/);
  });

  it('ไม่มี token หรือ token ไม่ตรง ใช้ไม่ได้', async () => {
    const { service } = serviceWith(null);

    await expect(service.consumeLoginToken('')).rejects.toThrow();
    await expect(service.consumeLoginToken('nope')).rejects.toThrow(/ไม่ถูกต้อง/);
  });

  it('POST /auth/magic คืน token รูปแบบเดียวกับ login ปกติ', async () => {
    const user = { _id: 'u1', email: 'a@mail.kmutt.ac.th', name: 'A', role: 'USER', student_id: '66000000001' };
    const c = new AuthController(
      { login: jest.fn().mockResolvedValue({ access_token: 'jwt' }) } as any,
      { consumeLoginToken: jest.fn().mockResolvedValue(user) } as any,
    );

    const r: any = await c.magic('t');

    expect(r.access_token).toBe('jwt');
    expect(r.user).toMatchObject({ id: 'u1', email: 'a@mail.kmutt.ac.th', role: 'USER' });
  });
});
