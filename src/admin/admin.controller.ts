import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';

import { AdminService } from './admin.service';
import { RegisterAdminDTO } from './dto/register-admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/schema/user.schema';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * เส้นนี้เคยเปิดให้ใครก็ได้สร้าง admin ซึ่งเท่ากับยกระบบให้คนแรกที่เจอ URL
   *
   * ตอนนี้เปิดให้สร้างโดยไม่ต้อง login ได้เฉพาะตอนที่ยังไม่มี admin สักคน
   * ซึ่งจำเป็นเพราะต้องมีคนแรกก่อนถึงจะมีใครมาอนุมัติคนต่อไปได้
   * พอมี admin แล้ว ต้องเป็น admin เท่านั้นที่สร้างเพิ่มได้
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post('register')
  async create(@Body() registerAdminDTO: RegisterAdminDTO, @Request() req) {
    const hasAdmin = await this.adminService.hasAnyAdmin();

    if (hasAdmin && req.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'ระบบมีผู้ดูแลอยู่แล้ว การเพิ่มผู้ดูแลใหม่ต้องทำโดยผู้ดูแลที่เข้าระบบอยู่',
      );
    }

    return this.adminService.create(registerAdminDTO);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.adminService.findByEmail(req.user.email);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.adminService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get(':email')
  findByEmail(@Param('email') email: string) {
    return this.adminService.findByEmail(email);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.adminService.delete(id);
  }
}
