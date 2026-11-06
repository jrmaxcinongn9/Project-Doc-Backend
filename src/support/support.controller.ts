import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/schema/user.schema';
import { CreateSupportDto, ReplySupportDto, UpdateSupportDto } from './dto/support.dto';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  // ทุกคนแจ้งได้ รวมคนที่ยัง login ไม่ได้ ถ้า login อยู่จะผูกเรื่องกับบัญชีด้วย
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  create(@Body() dto: CreateSupportDto, @Request() req) {
    return this.support.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  list(@Query('status') status?: string) {
    return this.support.list(status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSupportDto, @Request() req) {
    return this.support.setStatus(id, dto.status, req.user?.email);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':id/reply')
  reply(@Param('id') id: string, @Body() dto: ReplySupportDto, @Request() req) {
    return this.support.reply(id, dto.message, req.user?.email, !!dto.resolve);
  }
}
