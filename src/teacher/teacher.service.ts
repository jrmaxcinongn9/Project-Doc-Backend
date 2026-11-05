// src/teacher/teacher.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/schema/user.schema';

@Injectable()
export class TeacherService {
  constructor(private readonly userService: UserService) {}

  async create(data: {
    name: string;
    email: string;
    password: string;
    category?: string;
  }) {
    // เดิมเรียก create สองครั้ง ครั้งแรกสร้าง role USER ทิ้งไว้
    // ครั้งที่สองจึงชน email ซ้ำเสมอ สมัครครูไม่เคยสำเร็จ
    return this.userService.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: UserRole.TEACHER,
      category: data.category,
    });
  }

  async findAll() {
    return this.userService.findByRole(UserRole.TEACHER);
  }

  async findByEmail(email: string) {
    const user = await this.userService.findByEmail(email);
    if (!user || user.role !== UserRole.TEACHER) return null;
    return user;
  }

  async delete(id: string) {
    return this.userService.delete(id);
  }

  // นักศึกษาที่ครูคนนี้ดูแล
  //
  // เดิมครูทุกคนเห็นนักศึกษาทุกคน ซึ่งไม่ตรงกับงานจริง
  // ครูหนึ่งคนนิเทศสามสิบคนไม่ไหว การจับคู่จึงใช้ category ที่ตรงกัน
  // นักศึกษาเลือกตามสถานประกอบการที่ไปฝึก ครูเลือกตามความเชี่ยวชาญ
  async findMyStudents(email: string) {
    const teacher = await this.findByEmail(email);

    if (!teacher) {
      throw new NotFoundException('ไม่พบบัญชีครูของผู้ใช้นี้');
    }

    const category = (teacher as any).category as string | undefined;
    const students = await this.userService.findStudentsByCategory(category);

    return {
      category: category ?? null,
      total: students.length,
      // บอกให้ชัดว่าว่างเพราะยังไม่ได้ตั้งสาขา ไม่ใช่เพราะไม่มีนักศึกษา
      message: category
        ? undefined
        : 'บัญชีครูนี้ยังไม่ได้ตั้งสาขาความเชี่ยวชาญ จึงยังไม่มีนักศึกษาที่จับคู่ได้ ให้ผู้ดูแลระบบตั้งค่าให้',
      students,
    };
  }
}
