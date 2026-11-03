import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

function configWith(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as any;
}

describe('MailService', () => {
  let createTransport: jest.Mock;
  let sendMail: jest.Mock;

  beforeEach(() => {
    createTransport = nodemailer.createTransport as unknown as jest.Mock;
    sendMail = jest.fn();
    createTransport.mockReset();
    createTransport.mockReturnValue({ verify: jest.fn(), sendMail });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as any).fetch;
  });

  describe('เมื่อมี RESEND_API_KEY', () => {
    const base = {
      RESEND_API_KEY: 'test-key',
      FROM_EMAIL: 'noreply@example.com',
    };

    it('ไม่แตะ nodemailer เลย', () => {
      new MailService(configWith(base));
      expect(createTransport).not.toHaveBeenCalled();
    });

    it('ยิง HTTPS ไปที่ Resend พร้อม key และเนื้อหา', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true });
      (global as any).fetch = fetchMock;

      const service = new MailService(configWith(base));
      await service.sendVerifyMail('student@mail.kmutt.ac.th', 'https://x/y');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      expect(url).toBe('https://api.resend.com/emails');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer test-key');

      const body = JSON.parse(options.body);
      expect(body.from).toBe('noreply@example.com');
      expect(body.to).toEqual(['student@mail.kmutt.ac.th']);
      expect(body.html).toContain('https://x/y');
    });

    it('OTP ก็ไปทาง Resend เหมือนกัน', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true });
      (global as any).fetch = fetchMock;

      const service = new MailService(configWith(base));
      await service.sendResetOtpMail('someone@mail.kmutt.ac.th', '123456');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).toContain('123456');
    });

    it('Resend ตอบไม่ ok ต้องโยน error พร้อมรายละเอียด', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'domain is not verified',
      });

      const service = new MailService(configWith(base));

      await expect(
        service.sendVerifyMail('student@mail.kmutt.ac.th', 'https://x/y'),
      ).rejects.toThrow(/403.*domain is not verified/);
    });

    it('ไม่ตั้ง FROM_EMAIL ใช้โดเมนกลางของ Resend', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true });
      (global as any).fetch = fetchMock;

      const service = new MailService(configWith({ RESEND_API_KEY: 'k' }));
      await service.sendVerifyMail('a@mail.kmutt.ac.th', 'https://x/y');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.from).toBe('onboarding@resend.dev');
    });
  });

  describe('เมื่อไม่มี RESEND_API_KEY ถอยไปใช้ SMTP', () => {
    const smtp = {
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_USER: 'someone@gmail.com',
      SMTP_PASS: 'app-password',
    };

    const optionsFor = (values: Record<string, string | undefined>) => {
      new MailService(configWith(values));
      return createTransport.mock.calls[0][0];
    };

    it('พอร์ต 465 ต้อง secure true', () => {
      const opts = optionsFor({ ...smtp, SMTP_PORT: '465' });
      expect(opts.port).toBe(465);
      expect(opts.secure).toBe(true);
    });

    it('พอร์ต 587 ต้อง secure false', () => {
      const opts = optionsFor({ ...smtp, SMTP_PORT: '587' });
      expect(opts.secure).toBe(false);
    });

    it('SMTP_SECURE ทับกติกาพอร์ตได้', () => {
      const opts = optionsFor({ ...smtp, SMTP_PORT: '2525', SMTP_SECURE: 'true' });
      expect(opts.secure).toBe(true);
    });

    it('มี timeout กันค้างเมื่อพอร์ตขาออกถูกบล็อก', () => {
      const opts = optionsFor(smtp);
      expect(opts.connectionTimeout).toBeGreaterThan(0);
      expect(opts.socketTimeout).toBeGreaterThan(0);
    });

    it('SMTP_USER ที่ไม่ใช่อีเมลต้องถูกเตือนตั้งแต่ boot', () => {
      const spy = jest.spyOn(console, 'error');
      new MailService(configWith({ SMTP_HOST: 'h', SMTP_USER: 'อีเมลที่ใช้ส่ง' }));
      expect(
        spy.mock.calls.some((c) => String(c[0]).includes('ไม่ใช่อีเมล')),
      ).toBe(true);
    });

    it('ส่งจริงผ่าน transporter', async () => {
      const service = new MailService(configWith(smtp));
      await service.sendVerifyMail('a@mail.kmutt.ac.th', 'https://x/y');

      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail.mock.calls[0][0].to).toBe('a@mail.kmutt.ac.th');
    });
  });
});
