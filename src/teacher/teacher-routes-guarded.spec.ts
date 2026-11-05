// บัญชีครูเห็นข้อมูลนักศึกษาได้ เส้นสร้างบัญชีครูจึงต้องปิด
// เดิมเส้นนี้ไม่มีด่านเลย ใครก็ได้สร้างบัญชีครูให้ตัวเอง
import 'reflect-metadata';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/schema/user.schema';
import { TeacherController } from './teacher.controller';
import { RegisterTeacherDTO } from './dto/register-teacher';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

const guardsOn = (method: string) =>
  (Reflect.getMetadata('__guards__', TeacherController.prototype[method]) ?? [])
    .map((g: any) => g.name);

const rolesOn = (method: string) =>
  Reflect.getMetadata(ROLES_KEY, TeacherController.prototype[method]) ?? [];

describe('ด่านของเส้น teacher', () => {
  it('สร้างบัญชีครูต้อง login ก่อน', () => {
    expect(guardsOn('register')).toContain('JwtAuthGuard');
  });

  it('สร้างบัญชีครูต้องเป็น ADMIN', () => {
    expect(rolesOn('register')).toContain(UserRole.ADMIN);
  });

  it('ลบบัญชีครูต้องเป็น ADMIN', () => {
    expect(rolesOn('remove')).toContain(UserRole.ADMIN);
  });

  it('รายชื่อครูต้อง login ก่อน', () => {
    expect(guardsOn('findAll')).toContain('JwtAuthGuard');
  });
});

describe('ข้อมูลที่ต้องกรอกตอนสร้างบัญชีครู', () => {
  const errorsFor = async (body: any) =>
    (await validate(plainToInstance(RegisterTeacherDTO, body))).map((e) => e.property);

  const valid = {
    name: 'Teacher One',
    email: 'teacher@mail.kmutt.ac.th',
    password: 'secret123',
    category: 'SOFTWARE',
  };

  it('ครบถ้วนแล้วผ่าน', async () => {
    expect(await errorsFor(valid)).toHaveLength(0);
  });

  it('ไม่มี category ไม่ผ่าน เพราะใช้จับคู่กับนักศึกษา', async () => {
    const { category, ...withoutCategory } = valid;

    expect(await errorsFor(withoutCategory)).toContain('category');
  });

  it('category นอกรายการไม่ผ่าน', async () => {
    expect(await errorsFor({ ...valid, category: 'ANYTHING' })).toContain('category');
  });

  it('อีเมลนอกโดเมนมหาลัยไม่ผ่าน', async () => {
    expect(await errorsFor({ ...valid, email: 'teacher@gmail.com' })).toContain('email');
  });
});
