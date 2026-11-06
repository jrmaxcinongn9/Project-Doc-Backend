// src/user/user.controller.ts
import * as bcrypt from 'bcrypt';

import {
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  Body,
  UseGuards,
  Request,
  Param,
  Delete,
  Query,
  BadRequestException,
  NotFoundException,
  Patch,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';

import { ConfigService } from '@nestjs/config';

import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { AccountStatus, UserRole } from './schema/user.schema';
import { RegisterDTO } from './dto/register.dto';
import { ResendVerifyDTO } from './dto/resend-verify.dto';

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

    // admin ที่กดเพิ่มบัญชีเองคือคนตรวจสอบแล้ว ให้ใช้งานได้ทันที
    // ไม่อย่างนั้นบัญชีจะค้างที่ยังไม่ยืนยันอีเมลและรออนุมัติ
    // ทั้งที่ระบบส่งเมลยังใช้ไม่ได้ เหมือนบัญชีครูที่แก้ไปใน TeacherService
    const created: any = await this.userService.create({
      ...body,
      role: calledByAdmin ? body.role : UserRole.USER,
      ...(calledByAdmin
        ? { isVerified: true, status: AccountStatus.APPROVED }
        : {}),
    });

    // ส่งเมลยืนยันแบบไม่ให้ล้มทั้งการสมัคร ถ้าส่งเมลใช้ไม่ได้
    // บัญชีที่ admin สร้างยืนยันแล้ว ไม่ต้องส่งลิงก์
    let verifyLink: string | undefined;
    if (!calledByAdmin) {
      try {
        verifyLink = await this.userService.sendVerifyMail(
          created._id?.toString?.() ?? created.id,
        );
      } catch (err) {
        console.error('ส่งเมลยืนยันไม่สำเร็จ:', err);
      }
    }

    // ลิงก์ยืนยันคือกุญแจของบัญชีนั้น ปกติจึงไม่คืนออกมาทาง API
    // เปิดได้เฉพาะตอนสาธิตหรือตอนที่การส่งเมลยังใช้ไม่ได้ โดยตั้ง env ไว้ชัดเจน
    const exposeLink =
      this.configService.get<string>('EXPOSE_VERIFY_LINK') === 'true';

    return {
      ...created,
      ...(exposeLink && verifyLink ? { verifyLink } : {}),
      message: calledByAdmin
        ? 'เพิ่มบัญชีเรียบร้อย ใช้งานได้ทันที'
        : 'สมัครสำเร็จ กรุณายืนยันอีเมลจากลิงก์ที่ส่งไป แล้วรอผู้ดูแลระบบอนุมัติ',
    };
  }

  // ผู้ใช้ขอลิงก์ยืนยันใหม่ด้วยตัวเอง
  //
  // ลิงก์ที่ได้ตอนสมัครโชว์รอบเดียว รีเฟรชหรือกดย้อนกลับแล้วหายถาวร
  // เหลือทางเดียวคือรบกวน admin ให้กดให้ ซึ่งไม่ใช่ทางที่ควรเป็น
  //
  // เส้นนี้เปิดสาธารณะ แต่ต้องส่งรหัสผ่านมาถูกต้อง
  // เพราะลิงก์ยืนยันคือกุญแจของบัญชีนั้น ถ้าขอด้วยอีเมลอย่างเดียว
  // ใครก็ขอลิงก์ของคนอื่นแล้วยืนยันอีเมลแทนเจ้าตัวได้
  //
  // บัญชีที่ยืนยันไปแล้วไม่ออกลิงก์ใหม่ให้ กันการรีเซ็ตสถานะโดยไม่ตั้งใจ
  @Post('resend-verify-mine')
  @HttpCode(200)
  async resendVerifyMine(@Body() body: ResendVerifyDTO) {
    const user = await this.userService.findByEmail(body.email);

    // ตอบเหมือนกันทุกกรณีที่ยืนยันตัวไม่ผ่าน
    // ไม่บอกว่าอีเมลนี้มีบัญชีอยู่หรือไม่
    if (!user || !(await bcrypt.compare(body.password, user.password))) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    if (user.isVerified) {
      return { alreadyVerified: true, message: 'บัญชีนี้ยืนยันอีเมลแล้ว' };
    }

    const verifyLink = await this.userService.sendVerifyMail(
      (user as any)._id?.toString?.() ?? (user as any).id,
    );

    const exposeLink =
      this.configService.get<string>('EXPOSE_VERIFY_LINK') === 'true';

    return {
      alreadyVerified: false,
      ...(exposeLink ? { verifyLink } : {}),
      message: 'สร้างลิงก์ยืนยันใหม่แล้ว ลิงก์เดิมใช้ไม่ได้อีก',
    };
  }

  // ผู้ใช้กดลิงก์ยืนยันจากในเมล
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    const { approved, loginToken } = await this.userService.verifyEmail(token);

    // อนุมัติแล้ว คืนลิงก์เข้าระบบครั้งเดียว หน้าเว็บแลกเป็น session ให้ทันที
    if (approved) {
      return { message: 'ยืนยันอีเมลเรียบร้อย', login_token: loginToken };
    }

    return {
      message: 'ยืนยันอีเมลเรียบร้อย บัญชีอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ เมื่ออนุมัติแล้วจะได้รับอีเมลพร้อมลิงก์เข้าสู่ระบบ',
    };
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
  // ----------------------- รูปโปรไฟล์ของตัวเอง -----------------------
  // ทุกบทบาทใช้ได้ เปลี่ยนได้เฉพาะรูปของตัวเอง
  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: UserService.AVATAR_MAX_BYTES },
      fileFilter: (_req, file, cb) =>
        UserService.AVATAR_TYPES.includes(file.mimetype)
          ? cb(null, true)
          : cb(new BadRequestException('รูปโปรไฟล์ต้องเป็น PNG, JPG, WebP หรือ GIF'), false),
    }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) throw new BadRequestException('กรุณาเลือกรูป');
    return this.userService.setAvatar(req.user._id, file);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/avatar')
  async myAvatar(@Request() req, @Res() res: Response) {
    const avatar = await this.userService.getAvatar(req.user._id);
    if (!avatar) throw new NotFoundException('ยังไม่มีรูปโปรไฟล์');

    res.setHeader('Content-Type', avatar.mimetype);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    avatar.stream.pipe(res);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/avatar')
  async removeAvatar(@Request() req) {
    return this.userService.removeAvatar(req.user._id);
  }

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

  // ดู user ทั้งหมด
  // เดิม login ก็พอ นักศึกษาคนไหนก็ดึงชื่อ อีเมล รหัสนักศึกษาของทุกคนได้
  // หน้าที่เรียกเส้นนี้มีแต่ของครูและ admin หน้าของนักศึกษาไม่ใช้แล้ว
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @Get()
  async findAll(@Request() req) {
    // ครูเห็นเฉพาะตัวเองและนักศึกษาที่ตัวเองดูแล admin เห็นทั้งหมด
    if (req.user?.role === UserRole.ADMIN) return this.userService.findAll();
    return this.userService.findVisibleToTeacher(req.user?._id ?? req.user?.id);
  }

  // ดูตาม role
  // ไม่มีหน้าไหนเรียกเส้นนี้ ให้ admin เท่านั้น
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
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