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

import { ConfigService } from '@nestjs/config';

import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { AccountStatus, UserRole } from './schema/user.schema';
import { RegisterDTO } from './dto/register.dto';

import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateUserDto } from './dto/updateuser.dto';
import { stdout } from 'process';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  // สมัคร user
  // สมัครแล้วยังเข้าใช้งานไม่ได้ ต้องยืนยันอีเมลและรอ admin อนุมัติก่อน
  //
  // เส้นนี้เปิดให้ทุกคนเรียก เพราะนักศึกษาต้องสมัครเองได้
  // แต่เดิมมันรับฟิลด์ role จาก body แล้วส่งต่อให้ฐานข้อมูลตรง ๆ
  // ใครก็ได้จึงสมัครเป็น ADMIN ให้ตัวเองได้ และด่าน login ปล่อย ADMIN
  // ผ่านทั้งการยืนยันอีเมลและการรออนุมัติ เท่ากับเปิดประตูหน้าบ้านทิ้งไว้
  //
  // role จาก body จึงนับเฉพาะตอนที่คนเรียกเป็น ADMIN ที่ login แล้วเท่านั้น
  // ซึ่งคือตอนที่ admin เพิ่มบัญชีครูหรือบัญชีนักศึกษาจากหน้าจัดการผู้ใช้
  @UseGuards(OptionalJwtAuthGuard)
  @Post('register')
  async register(@Body() body: RegisterDTO, @Request() req) {
    const calledByAdmin = req.user?.role === UserRole.ADMIN;

    const created: any = await this.userService.create({
      ...body,
      role: calledByAdmin ? body.role : UserRole.USER,
    });

    // ส่งเมลยืนยันแบบไม่ให้ล้มทั้งการสมัคร ถ้าส่งเมลใช้ไม่ได้
    let verifyLink: string | undefined;
    try {
      verifyLink = await this.userService.sendVerifyMail(
        created._id?.toString?.() ?? created.id,
      );
    } catch (err) {
      console.error('ส่งเมลยืนยันไม่สำเร็จ:', err);
    }

    // ลิงก์ยืนยันคือกุญแจของบัญชีนั้น ปกติจึงไม่คืนออกมาทาง API
    // เปิดได้เฉพาะตอนสาธิตหรือตอนที่การส่งเมลยังใช้ไม่ได้ โดยตั้ง env ไว้ชัดเจน
    const exposeLink =
      this.configService.get<string>('EXPOSE_VERIFY_LINK') === 'true';

    return {
      ...created,
      ...(exposeLink && verifyLink ? { verifyLink } : {}),
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

  // admin กดยืนยันอีเมลแทนผู้ใช้ ใช้เมื่อเมลส่งไม่ถึง
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/verify-email')
  async verifyEmailByAdmin(@Param('id') id: string, @Request() req) {
    return this.userService.markVerifiedByAdmin(id, req.user?.email);
  }

  // นักศึกษาที่อนุมัติแล้วแต่ไม่มีครูคนไหนถือสาขาเดียวกัน
  // admin ใช้ดูว่าต้องหาครูเพิ่มสาขาไหน ไม่ให้มีใครตกหล่นจากการนิเทศ
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('without-teacher')
  async findWithoutTeacher() {
    return this.userService.findStudentsWithoutTeacher();
  }

  // admin ขอลิงก์ยืนยันใหม่ของบัญชีใดก็ได้ ใช้เมื่อผู้ใช้ทำลิงก์หายหรือลิงก์หมดอายุ
  // ลิงก์ใหม่ทับ token เดิมเสมอ ของเก่าจึงใช้ไม่ได้อีกหลังเรียกเส้นนี้
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/resend-verify')
  async resendVerify(@Param('id') id: string) {
    const verifyLink = await this.userService.sendVerifyMail(id);

    return {
      verifyLink,
      message: 'สร้างลิงก์ยืนยันใหม่แล้ว ส่งเมลไปด้วยถ้าระบบเมลใช้งานได้ ลิงก์เดิมใช้ไม่ได้อีก',
    };
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