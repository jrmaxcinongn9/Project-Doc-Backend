import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { AdminService } from './admin.service';
import { RegisterAdminDTO } from './dto/register-admin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('register')
  create(@Body() registerAdminDTO: RegisterAdminDTO) {
    return this.adminService.create(registerAdminDTO);
  }
d
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    const admin = await this.adminService.findByEmail(req.user.email);
    return admin;
  }

  @Get()
  findAll() {
    return this.adminService.findAll();
  }

  @Get(':email')
  findByEmail(@Param('email') email: string) {
    return this.adminService.findByEmail(email);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.adminService.delete(id);
  }


}