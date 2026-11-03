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
}
