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

  describe('เมื่อตั้ง Gmail ผ่าน Apps Script', () => {
    const base = { GMAIL_SCRIPT_URL: 'https://script.google.com/macros/s/X/exec', GMAIL_SCRIPT_SECRET: 's3cret' };

    it('ยิง POST ไปที่สคริปต์พร้อมรหัสลับ ผู้รับ และ HTML', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{"ok":true,"remaining":99}' });
      (global as any).fetch = fetchMock;

      await new MailService(configWith(base)).sendVerifyMail('student@mail.kmutt.ac.th', 'https://x/verify?t=1');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe(base.GMAIL_SCRIPT_URL);
      const body = JSON.parse(options.body);
      expect(body).toMatchObject({ secret: 's3cret', to: 'student@mail.kmutt.ac.th' });
      expect(body.html).toContain('https://x/verify?t=1');
      expect(createTransport).not.toHaveBeenCalled();
    });

    it('สคริปต์ตอบ ok:false ต้องโยน error พร้อมเหตุผล', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{"ok":false,"error":"unauthorized"}' });

      await expect(new MailService(configWith(base)).sendVerifyMail('a@b.c', 'l')).rejects.toThrow(/unauthorized/);
    });

    it('ได้หน้า HTML กลับมา (deploy ไม่ได้เปิดให้ Anyone) ถือว่าไม่ได้ส่ง', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '<html>Sign in</html>' });

      await expect(new MailService(configWith(base)).sendVerifyMail('a@b.c', 'l')).rejects.toThrow(/Gmail script/);
    });

    it('ส่งเมลแจ้งอนุมัติพร้อมลิงก์เข้าระบบ', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{"ok":true}' });
      (global as any).fetch = fetchMock;

      await new MailService(configWith(base)).sendApprovedMail('a@b.c', 'https://web/login/magic?token=t');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.subject).toContain('อนุมัติ');
      expect(body.html).toContain('https://web/login/magic?token=t');
    });

    it('มาก่อน Brevo เมื่อตั้งไว้พร้อมกัน', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{"ok":true}' });
      (global as any).fetch = fetchMock;

      await new MailService(configWith({ ...base, BREVO_API_KEY: 'k', FROM_EMAIL: 'x@y.z' })).sendVerifyMail('a@b.c', 'l');

      expect(fetchMock.mock.calls[0][0]).toBe(base.GMAIL_SCRIPT_URL);
    });
  });

  describe('เมื่อมี BREVO_API_KEY', () => {
    const base = { BREVO_API_KEY: 'xkeysib-test', FROM_EMAIL: 'sender@gmail.com' };

    it('ไม่แตะ nodemailer เลย', () => {
      new MailService(configWith(base));
      expect(createTransport).not.toHaveBeenCalled();
    });

    it('ยิง HTTPS ไปที่ Brevo พร้อม api-key ผู้ส่ง ผู้รับ และลิงก์ยืนยัน', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ messageId: 'm1' }) });
      (global as any).fetch = fetchMock;

      await new MailService(configWith(base)).sendVerifyMail('student@mail.kmutt.ac.th', 'https://x/verify?t=1');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.brevo.com/v3/smtp/email');
      expect(options.method).toBe('POST');
      expect(options.headers['api-key']).toBe('xkeysib-test');

      const body = JSON.parse(options.body);
      expect(body.sender).toEqual({ email: 'sender@gmail.com', name: 'Document Internship' });
      expect(body.to).toEqual([{ email: 'student@mail.kmutt.ac.th' }]);
      expect(body.htmlContent).toContain('https://x/verify?t=1');
    });

    it('ตั้งชื่อผู้ส่งได้ด้วย FROM_NAME', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true });
      (global as any).fetch = fetchMock;

      await new MailService(configWith({ ...base, FROM_NAME: 'ระบบฝึกงาน' })).sendResetOtpMail('a@mail.kmutt.ac.th', '123456');

      expect(JSON.parse(fetchMock.mock.calls[0][1].body).sender.name).toBe('ระบบฝึกงาน');
    });

    it('Brevo ปฏิเสธ ต้องโยน error พร้อมเหตุผล', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"code":"invalid_parameter","message":"sender not valid"}',
      });

      await expect(new MailService(configWith(base)).sendVerifyMail('a@b.c', 'l')).rejects.toThrow(/Brevo ตอบ 400: .*sender not valid/);
    });

    it('ไม่มี FROM_EMAIL ส่งไม่ได้ และบอกให้ตั้ง', async () => {
      (global as any).fetch = jest.fn();

      await expect(new MailService(configWith({ BREVO_API_KEY: 'k' })).sendVerifyMail('a@b.c', 'l')).rejects.toThrow(/FROM_EMAIL/);
      expect((global as any).fetch).not.toHaveBeenCalled();
    });

    it('มาก่อน Mailjet และ Resend เมื่อตั้งไว้พร้อมกัน', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true });
      (global as any).fetch = fetchMock;

      await new MailService(configWith({ ...base, MAILJET_API_KEY: 'a', MAILJET_SECRET_KEY: 'b', RESEND_API_KEY: 'r' }))
        .sendVerifyMail('a@b.c', 'l');

      expect(fetchMock.mock.calls[0][0]).toBe('https://api.brevo.com/v3/smtp/email');
    });
  });

  describe('เมื่อมีคู่กุญแจของ Mailjet', () => {
    const base = {
      MAILJET_API_KEY: 'mj-key',
      MAILJET_SECRET_KEY: 'mj-secret',
      FROM_EMAIL: 'noreply@example.com',
    };

    function okResponse() {
      return {
        ok: true,
        json: async () => ({ Messages: [{ Status: 'success' }] }),
      };
    }

    it('ไม่แตะ nodemailer เลย', () => {
      new MailService(configWith(base));
      expect(createTransport).not.toHaveBeenCalled();
    });

    it('ยิง HTTPS ไปที่ Mailjet พร้อม Basic auth และเนื้อหา', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okResponse());
      (global as any).fetch = fetchMock;

      const service = new MailService(configWith(base));
      await service.sendVerifyMail('student@mail.kmutt.ac.th', 'https://x/y');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      expect(url).toBe('https://api.mailjet.com/v3.1/send');
      expect(options.method).toBe('POST');

      const expected = Buffer.from('mj-key:mj-secret').toString('base64');
      expect(options.headers.Authorization).toBe(`Basic ${expected}`);

      const message = JSON.parse(options.body).Messages[0];
      expect(message.From).toEqual({ Email: 'noreply@example.com' });
      expect(message.To).toEqual([{ Email: 'student@mail.kmutt.ac.th' }]);
      expect(message.HTMLPart).toContain('https://x/y');
    });

    it('OTP ก็ไปทาง Mailjet เหมือนกัน', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okResponse());
      (global as any).fetch = fetchMock;

      const service = new MailService(configWith(base));
      await service.sendResetOtpMail('student@mail.kmutt.ac.th', '123456');

      const message = JSON.parse(fetchMock.mock.calls[0][1].body).Messages[0];
      expect(message.HTMLPart).toContain('123456');
    });

    it('ตอบไม่ ok แล้วโยน error พร้อมรายละเอียด', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '{"ErrorMessage":"API key authentication failed"}',
      });

      const service = new MailService(configWith(base));
      await expect(
        service.sendVerifyMail('student@mail.kmutt.ac.th', 'https://x/y'),
      ).rejects.toThrow('Mailjet ตอบ 401:');
    });

    it('ตอบ 200 แต่ Status ไม่ success ก็ต้องถือว่าพลาด', async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          Messages: [{ Status: 'error', Errors: [{ ErrorMessage: 'boom' }] }],
        }),
      });

      const service = new MailService(configWith(base));
      await expect(
        service.sendVerifyMail('student@mail.kmutt.ac.th', 'https://x/y'),
      ).rejects.toThrow('Mailjet ไม่ได้ส่ง');
    });

    it('มาก่อน Resend เมื่อตั้งไว้ทั้งคู่', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okResponse());
      (global as any).fetch = fetchMock;

      const service = new MailService(
        configWith({ ...base, RESEND_API_KEY: 'resend-key' }),
      );
      await service.sendVerifyMail('student@mail.kmutt.ac.th', 'https://x/y');

      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://api.mailjet.com/v3.1/send',
      );
    });

    it('มีกุญแจไม่ครบคู่ ต้องข้ามไปใช้ Resend แทน', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ ok: true });
      (global as any).fetch = fetchMock;

      const service = new MailService(
        configWith({
          MAILJET_API_KEY: 'mj-key',
          RESEND_API_KEY: 'resend-key',
          FROM_EMAIL: 'noreply@example.com',
        }),
      );
      await service.sendVerifyMail('student@mail.kmutt.ac.th', 'https://x/y');

      expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails');
    });

    it('ไม่มี FROM_EMAIL แล้วโยน error แทนที่จะยิงออกไป', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okResponse());
      (global as any).fetch = fetchMock;

      const service = new MailService(
        configWith({
          MAILJET_API_KEY: 'mj-key',
          MAILJET_SECRET_KEY: 'mj-secret',
        }),
      );
      await expect(
        service.sendVerifyMail('student@mail.kmutt.ac.th', 'https://x/y'),
      ).rejects.toThrow('ใช้ Mailjet ต้องตั้ง FROM_EMAIL');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('ถอยไปใช้ SMTP_USER เป็นผู้ส่งได้ถ้าไม่มี FROM_EMAIL', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okResponse());
      (global as any).fetch = fetchMock;

      const service = new MailService(
        configWith({
          MAILJET_API_KEY: 'mj-key',
          MAILJET_SECRET_KEY: 'mj-secret',
          SMTP_USER: 'sender@example.com',
        }),
      );
      await service.sendVerifyMail('student@mail.kmutt.ac.th', 'https://x/y');

      const message = JSON.parse(fetchMock.mock.calls[0][1].body).Messages[0];
      expect(message.From).toEqual({ Email: 'sender@example.com' });
    });
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
