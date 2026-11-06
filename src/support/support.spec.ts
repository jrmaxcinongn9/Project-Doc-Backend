// ระบบแจ้งปัญหา: ใครก็แจ้งได้ แม้ login ไม่ได้ admin เห็น ตอบทางเมล และปิดเรื่องได้
import { HttpException, NotFoundException } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { SupportStatus, SupportTopic } from './support.schema';

const ID = '64b000000000000000000001';

function ticket(over: any = {}) {
  const t: any = {
    _id: ID,
    name: 'สมชาย',
    email: 'a@mail.kmutt.ac.th',
    message: 'ไม่ได้รับเมลยืนยันเลยครับ',
    status: SupportStatus.OPEN,
    replies: [],
    ...over,
  };
  t.save = jest.fn(async () => t);
  t.markModified = jest.fn();
  return t;
}

function setup(t: any = ticket(), recent = 0) {
  const model: any = {
    countDocuments: jest.fn().mockResolvedValue(recent),
    create: jest.fn(async (d: any) => ({ _id: ID, ...d })),
    findById: jest.fn().mockResolvedValue(t),
    find: jest.fn(() => ({ sort: () => ({ limit: () => ({ lean: async () => [t] }) }) })),
  };
  const mail = { sendSupportReply: jest.fn().mockResolvedValue(undefined) };
  return { service: new SupportService(model, mail as any), model, mail, t };
}

describe('แจ้งปัญหา', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('คนที่ยังไม่ login แจ้งได้ อีเมลเก็บเป็นตัวพิมพ์เล็ก', async () => {
    const { service, model } = setup();

    const r = await service.create({ name: ' สมชาย ', email: ' A@MAIL.KMUTT.AC.TH ', message: 'ไม่ได้รับเมลยืนยันเลยครับ', topic: SupportTopic.ACCOUNT }, null);

    expect(r.message).toContain('ได้รับเรื่องแล้ว');
    expect(model.create.mock.calls[0][0]).toMatchObject({ name: 'สมชาย', email: 'a@mail.kmutt.ac.th', user_id: undefined });
  });

  it('คนที่ login อยู่ ผูกเรื่องกับบัญชี', async () => {
    const { service, model } = setup();

    await service.create({ name: 'A', email: 'a@b.c', message: 'ข้อความยาวพอแล้ว' }, { _id: 'u1', role: 'USER' });

    expect(model.create.mock.calls[0][0]).toMatchObject({ user_id: 'u1', user_role: 'USER' });
  });

  it('แจ้งเกิน 5 ครั้งในชั่วโมงเดียว ถูกปฏิเสธ', async () => {
    const { service, model } = setup(ticket(), 5);

    await expect(service.create({ name: 'A', email: 'a@b.c', message: 'ข้อความยาวพอแล้ว' })).rejects.toThrow(HttpException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('admin ตอบ ส่งเมลหาคนแจ้งพร้อมเรื่องเดิม และเก็บคำตอบไว้', async () => {
    const { service, mail, t } = setup();

    const r = await service.reply(ID, 'กด Login อีกครั้ง ระบบจะส่งเมลใหม่ให้', 'admin@x');

    expect(mail.sendSupportReply).toHaveBeenCalledWith('a@mail.kmutt.ac.th', 'สมชาย', 'ไม่ได้รับเมลยืนยันเลยครับ', 'กด Login อีกครั้ง ระบบจะส่งเมลใหม่ให้');
    expect(r.mailed).toBe(true);
    expect(t.replies[0]).toMatchObject({ by: 'admin@x', mailed: true });
    expect(t.status).toBe(SupportStatus.OPEN);
  });

  it('ตอบแล้วปิดเรื่องพร้อมกันได้', async () => {
    const { service, t } = setup();

    await service.reply(ID, 'แก้แล้วครับ', 'admin@x', true);

    expect(t.status).toBe(SupportStatus.RESOLVED);
    expect(t.resolvedBy).toBe('admin@x');
  });

  it('ส่งเมลไม่สำเร็จ คำตอบยังถูกเก็บ และบอกว่ายังไม่ได้ส่ง', async () => {
    const { service, mail, t } = setup();
    mail.sendSupportReply.mockRejectedValue(new Error('quota'));

    const r = await service.reply(ID, 'คำตอบ', 'admin@x');

    expect(r.mailed).toBe(false);
    expect(t.replies[0].mailed).toBe(false);
  });

  it('เปิดเรื่องที่ปิดไปแล้วกลับมาได้', async () => {
    const { service, t } = setup(ticket({ status: SupportStatus.RESOLVED, resolvedBy: 'x' }));

    await service.setStatus(ID, SupportStatus.OPEN, 'admin@x');

    expect(t.status).toBe(SupportStatus.OPEN);
    expect(t.resolvedBy).toBeUndefined();
  });

  it('id ไม่ถูกต้อง ตอบ 404', async () => {
    const { service } = setup();

    await expect(service.setStatus('nope', SupportStatus.RESOLVED)).rejects.toThrow(NotFoundException);
  });

  it('controller ส่งผู้ใช้ที่ login อยู่ต่อให้ service', async () => {
    const create = jest.fn();
    const c = new SupportController({ create } as any);

    c.create({ name: 'A', email: 'a@b.c', message: 'xxxxxxxxxx' }, { user: { _id: 'u1' } });

    expect(create.mock.calls[0][1]).toEqual({ _id: 'u1' });
  });
});
