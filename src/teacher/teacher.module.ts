// src/teacher/teacher.module.ts
import { Module } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { TeacherController } from './teacher.controller';
import { UserModule } from '../user/user.module'; // 👈 ดึง UserModule เข้ามา

@Module({
  imports: [
    UserModule, // 👈 เอา UserService มาใช้ใน TeacherService
  ],
  controllers: [TeacherController],
  providers: [TeacherService],
  exports: [TeacherService],
})
export class TeacherModule {}
