// src/user/user.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Delete,
  Query,
  BadRequestException,
  Patch,
} from '@nestjs/common';

import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccountStatus, UserRole } from './schema/user.schema';
import { RegisterDTO } from './dto/register.dto';

import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateUserDto } from './dto/updateuser.dto';
import { stdout } from 'process';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // สมัคร user
  // สมัครแล้วยังเข้าใช้งานไม่ได้ ต้องยืนยันอีเมลและรอ admin อนุมัติก่อน
  @Post('register')
  async register(@Body() body: RegisterDTO) {
    const created: any = await this.userService.create(body);

    // ส่งเมลยืนยันแบบไม่ให้ล้มทั้งการสมัคร ถ้า SMTP ใช้ไม่ได้
    try {
      await this.userService.sendVerifyMail(created._id?.toString?.() ?? created.id);
    } catch (err) {
      console.error('ส่งเมลยืนยันไม่สำเร็จ:', err);
    }

    return {
      ...created,
      message:
        'สมัครสำเร็จ กรุณายืนยันอีเมลจากลิงก์ที่ส่งไป แล้วรอผู้ดูแลระบบอนุมัติ',
    };
  }

  // ผู้ใช้กดลิงก์ยืนยันจากในเมล
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    await this.userService.verifyEmail(token);
    return { message: 'ยืนยันอีเมลเรียบร้อย บัญชีอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ' };
  }

  // รายชื่อที่รออนุมัติ
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('pending')
  async findPending() {
    return this.userService.findPending();
  }

  // admin อนุมัติ
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Request() req) {
    return this.userService.setStatus(
      id,
      AccountStatus.APPROVED,
      req.user?.email,
    );
  }

  // admin ปฏิเสธ
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Request() req) {
    return this.userService.setStatus(
      id,
      AccountStatus.REJECTED,
      req.user?.email,
    );
  }

  // โปรไฟล์ตัวเอง
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    const user = await this.userService.findByEmail(req.user.email);

    if (!user) {
      return { message: 'User not found' };
    }

    return {
      id: user._id?.toString?.() ?? user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      major: user.major,
      academicyear : user.academicYear
    };
  }

  // ดู user ทั้งหมด (login ก็พอ)
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  // ดูตาม role
  @UseGuards(JwtAuthGuard)
  @Get('by-role')
  async getByRole(@Query('role') role: string) {
    if (!role) {
      throw new BadRequestException('role is required');
    }

    if (!Object.values(UserRole).includes(role as UserRole)) {
      throw new BadRequestException('invalid role');
    }

    return this.userService.findByRole(role as UserRole);
  }

  // 🔥 ลบ user (admin only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.userService.delete(id);
  }

  // 🔥 แก้ user (admin only)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Patch(':id')
async update(
  @Param('id') id: string,
  @Body() body: UpdateUserDto,
) {
  return this.userService.updateUser(id, body);
}
}