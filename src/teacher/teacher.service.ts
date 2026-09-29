// src/teacher/teacher.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/schema/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TeacherService {
  constructor(private readonly userService: UserService) {}

  async create(data: { name: string; email: string; password: string }) {
    // hash password
    const hashed = await bcrypt.hash(data.password, 10);

    // สร้าง user ใหม่ แล้วกำหนด role = TEACHER
    const teacher = await this.userService.create({
      name: data.name,
      email: data.email,
      password: hashed,
    });

    // เปลี่ยน role
      return this.userService.create({
        name: data.name,
        email: data.email,
        password: hashed,
        role: UserRole.TEACHER,
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
