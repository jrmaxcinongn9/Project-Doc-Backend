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
  @Get()
  findAll(
    @Query('major') major?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.classroomService.findAll({ major, academicYear });
  }

  // ===============================
  // GET MY CLASSROOMS (ต้องอยู่ก่อน :id)
  // ===============================
  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMy(@Req() req) {
    return this.classroomService.findMyClassroom(req.user.id);
  }

  // ===============================
  // GET CLASSROOM WITH ASSIGNMENTS
  // ===============================
  @Get(':id/assignments')
  @UseGuards(JwtAuthGuard)
  async getAssignments(@Param('id') id: string) {
    return this.classroomService.findOneWithAssignments(id);
  }

  // ===============================
  // GET ONE CLASSROOM
  // ===============================
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classroomService.findOne(id);
  }

  // ===============================
  // UPDATE CLASSROOM
  // ===============================
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  update(@Param('id') id: string, @Body() dto: UpdateClassroomDto) {
    return this.classroomService.update(id, dto);
  }

  // ===============================
  // DELETE CLASSROOM
  // ===============================
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  remove(@Param('id') id: string) {
    return this.classroomService.remove(id);
  }

  // ===============================
  // AUTO ADD STUDENTS
  // ===============================
  @Post(':id/auto-add')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  autoAdd(@Param('id') id: string) {
    return this.classroomService.autoAddStudents(id);
  }

  // ===============================
  // REMOVE STUDENT
  // ===============================
  @Delete(':id/students/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  removeStudent(
    @Param('id') classroomId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.classroomService.removeStudent(classroomId, studentId);
  }
}