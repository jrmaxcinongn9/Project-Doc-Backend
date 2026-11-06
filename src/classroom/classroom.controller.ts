import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { ClassroomService } from './classroom.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../shared/enums/user-role.enum';
import { assertOwnsRoom, userIdOf } from '../shared/ownership';

@Controller('classroom')
export class ClassroomController {
  constructor(private readonly classroomService: ClassroomService) {}

  @Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER)
async create(@Body() dto: CreateClassroomDto, @Req() req) {

  const user = req.user;

  const userId =
    user?.userId ||
    user?.id ||
    user?._id ||
    user?.uid;

  if (!userId) {
    throw new BadRequestException('ไม่พบ userId');
  }

  const classroom = await this.classroomService.create(dto, userId);

  const classroomWithAssignments =
    await this.classroomService.findOneWithAssignments(classroom._id.toString());

  return classroomWithAssignments;
}

  // ===============================
  // GET ALL CLASSROOMS
  // ===============================
  // เดิมไม่มี guard เลย ใครไม่ได้ login ก็ดึงรายการห้องและ id นักศึกษาได้
  // และเส้นนี้เติมนักศึกษาเข้าห้องด้วย จึงต้องเป็นครูหรือ admin
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get()
  findAll(
    @Query('major') major?: string,
    @Query('academicYear') academicYear?: string,
    @Req() req?: any,
  ) {
    // ครูเห็นเฉพาะห้องที่ตัวเองสร้าง admin เห็นทุกห้อง
    const ownerId = req?.user?.role === 'ADMIN' ? undefined : userIdOf(req?.user) ?? 'none';
    return this.classroomService.findAll({ major, academicYear, ownerId });
  }

  // ===============================
  // GET MY CLASSROOMS (ต้องอยู่ก่อน :id)
  // ===============================
  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMy(@Req() req) {
    // JwtStrategy คืน id ไว้ที่ _id ไม่มี id
    // เดิมอ่าน req.user.id ซึ่งเป็น undefined เส้นนี้จึงคืนรายการว่างเสมอ
    return this.classroomService.findMyClassroom(req.user?._id ?? req.user?.id);
  }

  // ===============================
  // GET CLASSROOM WITH ASSIGNMENTS
  // ===============================
  @Get(':id/assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getAssignments(@Param('id') id: string, @Req() req) {
    const room = await this.classroomService.findOneWithAssignments(id);
    assertOwnsRoom(req.user, room);
    return room;
  }

  // ===============================
  // GET ONE CLASSROOM
  // ===============================
  // เดิมไม่มี guard ห้องนี้ populate นักศึกษามาทั้งคน ชื่อ อีเมล รหัส เปิดให้ทุกคนอ่าน
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req) {
    const room = await this.classroomService.findOne(id);
    assertOwnsRoom(req.user, room);
    return room;
  }

  // ===============================
  // UPDATE CLASSROOM
  // ===============================
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async update(@Param('id') id: string, @Body() dto: UpdateClassroomDto, @Req() req) {
    assertOwnsRoom(req.user, await this.classroomService.findOne(id));
    return this.classroomService.update(id, dto);
  }

  // ===============================
  // DELETE CLASSROOM
  // ===============================
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async remove(@Param('id') id: string, @Req() req) {
    assertOwnsRoom(req.user, await this.classroomService.findOne(id));
    return this.classroomService.remove(id);
  }

  // ===============================
  // AUTO ADD STUDENTS
  // ===============================
  @Post(':id/auto-add')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async autoAdd(@Param('id') id: string, @Req() req) {
    assertOwnsRoom(req.user, await this.classroomService.findOne(id));
    return this.classroomService.autoAddStudents(id);
  }

  // ===============================
  // REMOVE STUDENT
  // ===============================
  @Delete(':id/students/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async removeStudent(
    @Param('id') classroomId: string,
    @Param('studentId') studentId: string,
    @Req() req,
  ) {
    assertOwnsRoom(req.user, await this.classroomService.findOne(classroomId));
    return this.classroomService.removeStudent(classroomId, studentId);
  }
}