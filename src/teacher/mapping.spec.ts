// ครูทุกคนเคยเห็นนักศึกษาทุกคน ซึ่งไม่ตรงกับงานจริง
// ครูหนึ่งคนนิเทศสามสิบคนไม่ไหว อาจารย์จึงให้จับคู่ด้วย category
// นักศึกษาเลือกตามสถานประกอบการที่ไปฝึก ครูเลือกตามความเชี่ยวชาญ
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

import { TeacherService } from './teacher.service';
import { UserService } from '../user/user.service';
import { AccountStatus, User, UserRole } from '../user/schema/user.schema';
import { MailService } from '../mail/mail.service';

describe('จับคู่ครูกับนักศึกษา', () => {
  let userService: UserService;
  let teacherService: TeacherService;
  let lastFilter: any;
  let docs: any[];

  beforeEach(async () => {
    lastFilter = undefined;
    docs = [];

    const model = {
      find: jest.fn((filter: any) => {
        lastFilter = filter;
        return { select: () => ({ exec: () => Promise.resolve(docs) }), exec: () => Promise.resolve(docs) };
      }),
      findOne: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        TeacherService,
        { provide: getModelToken(User.name), useValue: model },
        { provide: MailService, useValue: { sendVerifyMail: jest.fn() } },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    userService = moduleRef.get(UserService);
    teacherService = moduleRef.get(TeacherService);
  });

  describe('findStudentsByCategory', () => {
    it('กรองเฉพาะ role USER', async () => {
      await userService.findStudentsByCategory('SOFTWARE');

      expect(lastFilter.role).toBe(UserRole.USER);
    });

    it('กรองด้วย category ที่ส่งมา', async () => {
      await userService.findStudentsByCategory('NETWORK');

      expect(lastFilter.category).toBe('NETWORK');
    });

    it('นับเฉพาะบัญชีที่อนุมัติแล้ว', async () => {
      await userService.findStudentsByCategory('SOFTWARE');

      expect(lastFilter.status).toBe(AccountStatus.APPROVED);
    });

    it('ไม่มี category ส่งมา คืนค่าว่างโดยไม่ไปถามฐานข้อมูล', async () => {
      const result = await userService.findStudentsByCategory(undefined);

      expect(result).toEqual([]);
      expect(lastFilter).toBeUndefined();
    });
  });

  describe('findMyStudents', () => {
    const teacherWith = (category?: string) => ({
      email: 'teacher@mail.kmutt.ac.th',
      role: UserRole.TEACHER,
      category,
    });

    it('คืนนักศึกษาที่ category ตรงกับครู', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(teacherWith('SOFTWARE') as any);
      docs = [{ email: 'a@mail.kmutt.ac.th' }, { email: 'b@mail.kmutt.ac.th' }];

      const result = await teacherService.findMyStudents('teacher@mail.kmutt.ac.th');

      expect(result.total).toBe(2);
      expect(result.category).toBe('SOFTWARE');
    });

    it('ใช้ category ของครูคนที่ login ไม่ใช่ค่าที่ส่งเข้ามา', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(teacherWith('DATA') as any);

      await teacherService.findMyStudents('teacher@mail.kmutt.ac.th');

      expect(lastFilter.category).toBe('DATA');
    });

    it('ครูที่ยังไม่ตั้งสาขา ได้รายการว่างพร้อมคำอธิบาย', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(teacherWith(undefined) as any);

      const result = await teacherService.findMyStudents('teacher@mail.kmutt.ac.th');

      expect(result.students).toEqual([]);
      expect(result.message).toMatch(/ยังไม่ได้ตั้งสาขา/);
    });

    it('ครูที่ตั้งสาขาแล้วไม่ต้องมีข้อความเตือน', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(teacherWith('SOFTWARE') as any);

      const result = await teacherService.findMyStudents('teacher@mail.kmutt.ac.th');

      expect(result.message).toBeUndefined();
    });

    it('ไม่ใช่บัญชีครู ต้องไม่ได้รายชื่อ', async () => {
      jest.spyOn(userService, 'findByEmail').mockResolvedValue({
        email: 'student@mail.kmutt.ac.th',
        role: UserRole.USER,
        category: 'SOFTWARE',
      } as any);

      await expect(
        teacherService.findMyStudents('student@mail.kmutt.ac.th'),
      ).rejects.toThrow(/ไม่พบบัญชีครู/);
    });
  });

  describe('findStudentsWithoutTeacher', () => {
    it('ตัดสาขาที่มีครูถืออยู่แล้วออก', async () => {
      jest.spyOn(userService, 'findByRole').mockResolvedValue([
        { category: 'SOFTWARE' },
        { category: 'DATA' },
      ] as any);

      await userService.findStudentsWithoutTeacher();

      expect(lastFilter.$or).toContainEqual({
        category: { $nin: ['SOFTWARE', 'DATA'] },
      });
    });

    it('นับนักศึกษาที่ไม่มี category ด้วย', async () => {
      jest.spyOn(userService, 'findByRole').mockResolvedValue([] as any);

      await userService.findStudentsWithoutTeacher();

      expect(lastFilter.$or).toContainEqual({ category: { $exists: false } });
    });

    it('ครูที่ยังไม่ตั้งสาขา ไม่นับว่าครอบคลุมสาขาว่าง', async () => {
      jest.spyOn(userService, 'findByRole').mockResolvedValue([
        { category: undefined },
        { category: 'SOFTWARE' },
      ] as any);

      await userService.findStudentsWithoutTeacher();

      expect(lastFilter.$or).toContainEqual({
        category: { $nin: ['SOFTWARE'] },
      });
    });

    it('ดูเฉพาะนักศึกษาที่อนุมัติแล้ว', async () => {
      jest.spyOn(userService, 'findByRole').mockResolvedValue([] as any);

      await userService.findStudentsWithoutTeacher();

      expect(lastFilter.role).toBe(UserRole.USER);
      expect(lastFilter.status).toBe(AccountStatus.APPROVED);
    });
  });
});
