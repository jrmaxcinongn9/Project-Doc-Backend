// GET /user ขอแค่ login ไม่ได้ดูบทบาท นักศึกษาคนไหนก็เรียกได้
// และเดิมคืนเอกสารทั้งก้อนรวม password ที่ผ่าน bcrypt มาแล้ว
// นักศึกษาหนึ่งคนจึงดึง hash ของ admin และครูทุกคนออกไปได้
import { model } from 'mongoose';

import { User, UserSchema } from './schema/user.schema';

describe('password ต้องไม่หลุดออกไปกับ response', () => {
  const UserModel = model(User.name + 'LeakSpec', UserSchema);

  const build = () =>
    new UserModel({
      name: 'Someone Here',
      email: 'someone@mail.kmutt.ac.th',
      password: '$2b$10$abcdefghijklmnopqrstuv',
    });

  it('toJSON ไม่มีฟิลด์ password', () => {
    expect(build().toJSON()).not.toHaveProperty('password');
  });

  it('toObject ไม่มีฟิลด์ password', () => {
    expect(build().toObject()).not.toHaveProperty('password');
  });

  it('แปลงเป็นข้อความแล้วไม่มีค่า hash ปนอยู่', () => {
    expect(JSON.stringify(build())).not.toContain('$2b$10$');
  });

  it('ฟิลด์อื่นยังอยู่ครบ', () => {
    const json: any = build().toJSON();

    expect(json.email).toBe('someone@mail.kmutt.ac.th');
    expect(json.name).toBe('Someone Here');
  });

  it('ยังอ่าน password จากตัว document ได้ ด่าน login จึงทำงานต่อได้', () => {
    // bcrypt.compare อ่านค่าจากตรงนี้ ไม่ได้ผ่าน toJSON
    expect(build().password).toBe('$2b$10$abcdefghijklmnopqrstuv');
  });
});
