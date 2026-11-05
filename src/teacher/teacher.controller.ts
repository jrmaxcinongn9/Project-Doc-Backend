// src/teacher/teacher.controller.ts
import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/schema/user.schema';
import { RegisterTeacherDTO } from './dto/register-teacher';

@Controller('teacher')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  // บัญชีครูสร้างโดย admin เท่านั้น ครูไม่สมัครเอง
  // เดิมเส้นนี้ไม่มีด่านเลย ใครก็ได้สร้างบัญชีครูให้ตัวเอง
  // แล้วเห็นข้อมูลนักศึกษาทั้งระบบได้
  //
  // DTO บังคับ category ด้วย เพราะเป็นค่าที่ใช้จับคู่ครูกับนักศึกษา
  // ครูที่ไม่มีค่านี้จะไม่ถูกจับคู่กับใครเลย
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('register')
  async register(@Body() body: RegisterTeacherDTO) {
    return this.teacherService.create(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.teacherService.findByEmail(req.user.email);
  }

  // รายชื่อครูเป็นข้อมูลภายใน ไม่ใช่ของสาธารณะ
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    return this.teacherService.findAll();
  }

  // เดิมลบบัญชีครูได้โดยไม่ต้อง login
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.teacherService.delete(id);
  }
}
