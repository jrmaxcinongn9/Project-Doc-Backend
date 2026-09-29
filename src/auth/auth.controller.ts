// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Get,
  Delete,
  Patch,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDTO } from './dto/login.dto';
import { LocalAuthGuard } from './local-auth.guard';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/schema/user.schema';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  // 🔹 Login ปกติ ใช้ LocalAuthGuard (ทุก role ที่มี email/password ถูกต้อง)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    const { access_token } = await this.authService.login(req.user);

    return {
      message: 'Login successful',
      access_token,
      user: {
        id: req.user._id?.toString?.() ?? req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        major: req.user.major || '',
        academicYear: req.user.academicYear || '',
        student_id: req.user.student_id || null,
      },
    };
  }

  // 🔹 Admin login
  @Post('admin-login')
  async adminLogin(@Body() loginDto: LoginDTO) {
    const user = await this.authService.validateAdmin(
      loginDto.email,
      loginDto.password,
    );

    console.log('Admin login attempt:', user);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied. Admin role required.');
    }

    const { access_token } = await this.authService.login(user);

    return {
      message: 'Admin login successful',
      access_token,
      user: {
        id: user._id?.toString?.() ?? user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  // 🔹 Teacher login
  @Post('teacher-login')
  async teacherLogin(@Body() loginDto: LoginDTO) {
    const user = await this.authService.validateTeacher(
      loginDto.email,
      loginDto.password,
    );

    console.log('Teacher login attempt:', user);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.role !== UserRole.TEACHER) {
      throw new ForbiddenException('Access denied. Teacher role required.');
    }

    const { access_token } = await this.authService.login(user);

    return {
      message: 'Teacher login successful',
      access_token,
      user: {
        id: user._id?.toString?.() ?? user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  // 🔹 ขอ OTP รีเซ็ตรหัสผ่าน
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    await this.authService.generateResetOtp(email);

    return {
      message:
        'ถ้าอีเมลนี้มีอยู่ในระบบ เราได้ส่งรหัส OTP ไปให้แล้ว กรุณาตรวจสอบกล่องจดหมายของคุณ',
    };
  }

  // 🔹 ใช้ OTP รีเซ็ตรหัสผ่าน
  @Post('reset-password')
  async resetPasswordWithOtp(
    @Body('email') email: string,
    @Body('otp') otp: string,
    @Body('password') password: string,
  ) {
    if (!email || !otp || !password) {
      throw new BadRequestException('Email, OTP and password are required');
    }

    await this.authService.resetPasswordWithOtp(email, otp, password);

    return {
      message: 'เปลี่ยนรหัสผ่านสำเร็จ',
    };
  }

  // 🔹 ดึง users / admins / teachers ทั้งหมด (เฉพาะ ADMIN)
  @Get('all-roles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllRoles() {
    const all = await this.authService.getAllRoles();

    const pick = (arr: any[]) =>
      arr.map((user) => ({
        id: user._id?.toString?.() ?? user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }));

    return {
      users: pick(all.users),
      admins: pick(all.admins),
      teachers: pick(all.teachers),
    };
  }

  // 🔹 ลบ user จาก id เดียว (ไม่ต้องแยก role)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('delete-by-id')
  async deleteById(@Body('id') id: string) {
    if (!id) {
      throw new BadRequestException('id จำเป็นต้องกรอก');
    }

    return this.userService.delete(id);
  }

  // 🔹 ADMIN อัปเดต role / name / email
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('update-role')
async updateRole(
  @Body()
  body: {
    id: string;
    role?: UserRole;
    name?: string;
    email?: string;
    major?: string;
    academicYear?: string;
    student_id?: string;
  },
) {
  const { id, role, name, email, major, academicYear, student_id } = body;

  const updates: any = {};

  if (role) updates.role = role;
  if (name) updates.name = name;
  if (email) updates.email = email;
  if (major) updates.major = major;
  if (academicYear) updates.academicYear = academicYear;
  if (student_id) updates.student_id = student_id;

  const updated = await this.userService.updateUser(id, updates);

  return {
    message: 'อัปเดตสำเร็จ',
    user: updated,
  };
}
}