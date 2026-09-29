import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  ForbiddenException,
  Put,
  Delete,
  Param,
  Req,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocService } from './doc.service';
import { CreateDocDto } from './dto/create-doc.dto';

@Controller('assignment')
export class DocController {
  constructor(private readonly docService: DocService) {}

  // ===================================================
  // ✅ CREATE ASSIGNMENT (ADMIN / TEACHER)
  // ===================================================
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createDocDtos: CreateDocDto | CreateDocDto[], @Req() req) {
    const user = req.user;
    const userObj = {
      userId: user.id || user._id,
      name: user.name || user.email,
    };

    // 💡 ข้อแนะนำเสริม: ตรวจสอบให้แน่ใจว่าไฟล์ src/doc/dto/create-doc.dto.ts 
    // มีการเพิ่มตัวแปร due_date?: string; และ publish_date?: string; ไว้แล้ว
    if (Array.isArray(createDocDtos)) {
      return this.docService.createMultiple(createDocDtos, userObj);
    } else {
      return this.docService.create(createDocDtos, userObj);
    }
  }

  // ===================================================
  // ✅ GET ALL ASSIGNMENTS
  // ===================================================
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    return this.docService.findAll();
  }

  // ===================================================
  // ✅ ASSIGNMENT ของตัวเอง
  // ===================================================
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async findMyDocs(@Request() req) {
    const user = req.user;
    const userId = user._id || user.id || user.userId || user.sub;

    return this.docService.findByUserId(userId);
  }

  // ===================================================
  // ✅ UPDATE ASSIGNMENT (📅 แก้ไขรองรับวันที่กำหนดส่ง)
  // ===================================================
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    // 🔍 ขยายขอบเขต Body ให้ดักรับฟิลด์วันที่เพิ่มเติม
    @Body() body: { assignment_name?: string; due_date?: string; publish_date?: string },
    @Request() req,
  ) {
    const user = req.user;
    const role = user.role;
    const userId = user._id || user.id || user.userId || user.sub;

    const assignment = await this.docService.findOneById(id);

    if (
      assignment.user_id !== userId &&
      role !== 'ADMIN' &&
      role !== 'TEACHER'
    ) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์แก้ไข assignment นี้');
    }

    // 🛠️ ประกอบโครงสร้างข้อมูลใหม่และทำการ Parse วันที่เป็น Date Object ก่อนยิงลงฐานข้อมูล MongoDB
    const updateData: any = {};
    
    if (body.assignment_name !== undefined) {
      updateData.assignment_name = body.assignment_name;
    }
    if (body.due_date !== undefined) {
      updateData.due_date = body.due_date ? new Date(body.due_date) : null;
    }
    if (body.publish_date !== undefined) {
      updateData.publish_date = body.publish_date ? new Date(body.publish_date) : null;
    }

    return this.docService.update(id, updateData);
  }

  // ===================================================
  // ✅ DELETE ASSIGNMENT
  // ===================================================
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req) {
    const user = req.user;
    const role = user.role;
    const userId = user._id || user.id || user.userId || user.sub;

    const assignment = await this.docService.findOneById(id);

    if (
      assignment.user_id !== userId &&
      role !== 'ADMIN' &&
      role !== 'TEACHER'
    ) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ลบ assignment นี้');
    }

    return this.docService.delete(id);
  }
}