// คะแนนและ feedback เป็นของครู นักศึกษาต้องแก้เองไม่ได้
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/schema/user.schema';
import { DocController } from './doc.controller';
import { GradeStudentDto } from './dto/grade-student.dto';
import { CreateDocDto } from './dto/create-doc.dto';

const rolesOn = (method: string) =>
  Reflect.getMetadata(ROLES_KEY, DocController.prototype[method]) ?? [];

const guardsOn = (method: string) =>
  (Reflect.getMetadata('__guards__', DocController.prototype[method]) ?? [])
    .map((g: any) => g.name);

describe('ด่านของเส้นให้คะแนน', () => {
  it('ให้คะแนนได้เฉพาะครูกับ admin', () => {
    expect(rolesOn('gradeStudent')).toEqual(
      expect.arrayContaining([UserRole.TEACHER, UserRole.ADMIN]),
    );
  });

  it('นักศึกษาไม่อยู่ในรายชื่อที่ให้คะแนนได้', () => {
    expect(rolesOn('gradeStudent')).not.toContain(UserRole.USER);
  });

  it('ดูคะแนนตัวเองต้อง login ก่อน', () => {
    expect(guardsOn('findMyScores')).toContain('JwtAuthGuard');
  });
});

describe('ค่าที่รับได้ตอนให้คะแนน', () => {
  const errorsFor = async (body: any) =>
    (await validate(plainToInstance(GradeStudentDto, body))).map((e) => e.property);

  it('คะแนนกับ feedback พร้อมกันได้', async () => {
    expect(await errorsFor({ score: 8, feedback: 'ดี' })).toHaveLength(0);
  });

  it('ส่งมาแต่ feedback ก็ได้', async () => {
    expect(await errorsFor({ feedback: 'ดี' })).toHaveLength(0);
  });

  it('คะแนนติดลบไม่ผ่าน', async () => {
    expect(await errorsFor({ score: -1 })).toContain('score');
  });

  it('คะแนนที่ไม่ใช่ตัวเลขไม่ผ่าน', async () => {
    expect(await errorsFor({ score: 'แปดคะแนน' })).toContain('score');
  });
});

describe('คะแนนเต็มตอนสร้างงาน', () => {
  const base = {
    assignment_name: 'รายงาน',
    classroom: '6aeb79a283cd8c771e00a03f',
  };

  const errorsFor = async (body: any) =>
    (await validate(plainToInstance(CreateDocDto, body))).map((e) => e.property);

  it('กรอกคะแนนเต็มได้ตอนสร้าง', async () => {
    expect(await errorsFor({ ...base, max_score: 10 })).toHaveLength(0);
  });

  it('ไม่กรอกก็ได้ งานบางชิ้นไม่คิดคะแนน', async () => {
    expect(await errorsFor(base)).toHaveLength(0);
  });

  it('คะแนนเต็มเป็นศูนย์ไม่ผ่าน', async () => {
    expect(await errorsFor({ ...base, max_score: 0 })).toContain('max_score');
  });
});
