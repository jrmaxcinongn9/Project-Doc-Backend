import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

function configWith(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
  } as any;
}

describe('MailService เลือกโหมด secure ตามพอร์ต', () => {
  let createTransport: jest.Mock;

  beforeEach(() => {
    createTransport = nodemailer.createTransport as unknown as jest.Mock;
    createTransport.mockReset();
    createTransport.mockReturnValue({
      verify: jest.fn(),
      sendMail: jest.fn(),
    });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const optionsFor = (values: Record<string, string | undefined>) => {
    new MailService(configWith(values));
    return createTransport.mock.calls[0][0];
  };

  it('พอร์ต 465 ต้อง secure true', () => {
    const opts = optionsFor({
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_USER: 'someone@gmail.com',
      SMTP_PASS: 'app-password',
    });

    expect(opts.port).toBe(465);
    expect(opts.secure).toBe(true);
  });

  it('พอร์ต 587 ต้อง secure false', () => {
    const opts = optionsFor({
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '587',
      SMTP_USER: 'someone@gmail.com',
      SMTP_PASS: 'app-password',
    });

    expect(opts.port).toBe(587);
    expect(opts.secure).toBe(false);
  });

  it('ไม่ตั้งพอร์ตเลยใช้ 587 และ secure false', () => {
    const opts = optionsFor({ SMTP_HOST: 'smtp.gmail.com' });

    expect(opts.port).toBe(587);
    expect(opts.secure).toBe(false);
  });

  it('SMTP_SECURE ทับกติกาพอร์ตได้', () => {
    const opts = optionsFor({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '2525',
      SMTP_SECURE: 'true',
    });

    expect(opts.secure).toBe(true);
  });

  it('มี timeout กันค้างเมื่อพอร์ตขาออกถูกบล็อก', () => {
    const opts = optionsFor({ SMTP_HOST: 'smtp.gmail.com' });

    expect(opts.connectionTimeout).toBeGreaterThan(0);
    expect(opts.greetingTimeout).toBeGreaterThan(0);
    expect(opts.socketTimeout).toBeGreaterThan(0);
  });

  it('SMTP_USER ที่ไม่ใช่อีเมลต้องถูกเตือนตั้งแต่ boot', () => {
    const spy = jest.spyOn(console, 'error');

    new MailService(
      configWith({
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_USER: 'อีเมลที่ใช้ส่ง',
      }),
    );

    expect(
      spy.mock.calls.some((call) => String(call[0]).includes('ไม่ใช่อีเมล')),
    ).toBe(true);
  });

  it('SMTP_USER ที่เป็นอีเมลจริงต้องไม่ถูกเตือน', () => {
    const spy = jest.spyOn(console, 'error');

    new MailService(
      configWith({
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_USER: 'someone@gmail.com',
      }),
    );

    expect(
      spy.mock.calls.some((call) => String(call[0]).includes('ไม่ใช่อีเมล')),
    ).toBe(false);
  });
});
