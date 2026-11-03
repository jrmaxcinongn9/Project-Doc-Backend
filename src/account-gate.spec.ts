import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ForbiddenException } from '@nestjs/common';

import { RegisterDTO } from './user/dto/register.dto';
import { RegisterTeacherDTO } from './teacher/dto/register-teacher';
import { AccountStatus, UserRole } from './user/schema/user.schema';
import { AuthService } from './auth/auth.service';

const studentBase = {
  name: 'Somchai Jai',
  email: '65130500001@mail.kmutt.ac.th',
  password: 'secret1',
  major: 'CPE',
  student_id: '65130500001',
  category: 'SOFTWARE',
};

async function errorsFor(dto: any, payload: any): Promise<string[]> {
  const instance = plainToInstance(dto, payload);
  const errors = await validate(instance as object);
  return errors.map((e) => e.property);
}

describe('RegisterDTO หลังย้าย academicYear ออก', () => {
  it('ผ่านโดยไม่ต้องส่ง academicYear', async () => {
    expect(await errorsFor(RegisterDTO, studentBase)).toEqual([]);
  });

  it('ไม่ส่ง category แล้วต้องไม่ผ่าน', async () => {
    const { category, ...withoutCategory } = studentBase;
    expect(await errorsFor(RegisterDTO, withoutCategory)).toContain('category');
  });

  it('category นอกรายการต้องไม่ผ่าน', async () => {
    expect(
      await errorsFor(RegisterDTO, { ...studentBase, category: 'ROCKET' }),
    ).toContain('category');
  });

  it('ส่ง academicYear มาด้วยก็ยังผ่าน เพราะไม่ใช่ฟิลด์ที่สนใจแล้ว', async () => {
    expect(
      await errorsFor(RegisterDTO, { ...studentBase, academicYear: 2569 }),
    ).toEqual([]);
  });
});

describe('RegisterTeacherDTO', () => {
  const teacherBase = {
    name: 'Kru Somsri',
    email: 'somsri@mail.kmutt.ac.th',
    password: 'secret1',
    category: 'NETWORK',
  };

  it('ผ่านเมื่อมี category', async () => {
    expect(await errorsFor(RegisterTeacherDTO, teacherBase)).toEqual([]);
  });

  it('ไม่มี category ต้องไม่ผ่าน', async () => {
    const { category, ...rest } = teacherBase;
    expect(await errorsFor(RegisterTeacherDTO, rest)).toContain('category');
  });
});

describe('ด่านก่อน login', () => {
  // เรียก private method ผ่าน prototype เพราะต้องการทดสอบกติกาล้วน ๆ
  const gate = (user: any) =>
    (AuthService.prototype as any).assertCanLogin.call({}, user);

  it('ยังไม่ยืนยันอีเมล เข้าไม่ได้', () => {
    expect(() =>
      gate({
        role: UserRole.USER,
        isVerified: false,
        status: AccountStatus.APPROVED,
      }),
    ).toThrow(ForbiddenException);
  });

  it('ยืนยันแล้วแต่ยังรออนุมัติ เข้าไม่ได้', () => {
    expect(() =>
      gate({
        role: UserRole.USER,
        isVerified: true,
        status: AccountStatus.PENDING,
      }),
    ).toThrow(ForbiddenException);
  });

  it('ถูกปฏิเสธ เข้าไม่ได้', () => {
    expect(() =>
      gate({
        role: UserRole.USER,
        isVerified: true,
        status: AccountStatus.REJECTED,
      }),
    ).toThrow(ForbiddenException);
  });

  it('ยืนยันแล้วและอนุมัติแล้ว เข้าได้', () => {
    expect(() =>
      gate({
        role: UserRole.USER,
        isVerified: true,
        status: AccountStatus.APPROVED,
      }),
    ).not.toThrow();
  });

  it('ครูก็ต้องผ่านด่านเดียวกัน', () => {
    expect(() =>
      gate({
        role: UserRole.TEACHER,
        isVerified: true,
        status: AccountStatus.PENDING,
      }),
    ).toThrow(ForbiddenException);
  });

  it('ADMIN ข้ามด่านได้ เพราะไม่มีใครอนุมัติ admin คนแรกให้', () => {
    expect(() =>
      gate({
        role: UserRole.ADMIN,
        isVerified: false,
        status: AccountStatus.PENDING,
      }),
    ).not.toThrow();
  });
});
