// src/teacher/teacher.controller.ts
import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('teacher')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Post('register')
  async register(@Body() body: { name: string; email: string; password: string }) {
    return this.teacherService.create(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.teacherService.findByEmail(req.user.email);
  }

  @Get()
  async findAll() {
    return this.teacherService.findAll();
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.teacherService.delete(id);
  }
}
