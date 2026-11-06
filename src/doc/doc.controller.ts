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
  Patch,
  Req,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/schema/user.schema';
import { assertOwnsAssignment, assertOwnsRoom, userIdOf } from '../shared/ownership';
import { DocService } from './doc.service';
import { CreateDocDto } from './dto/create-doc.dto';
import { GradeStudentDto } from './dto/grade-student.dto';

@Controller('assignment')
export class DocController {
  constructor(private readonly docService: DocService) {}

  // ===================================================
  // ✅ CREATE ASSIGNMENT (ADMIN / TEACHER)
  // ===================================================
  @Post()
  // เดิมนักศึกษาก็สร้างงานได้ เพราะเช็คแค่ว่า login
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async create(@Body() createDocDtos: CreateDocDto | CreateDocDto[], @Req() req) {
    const user = req.user;
    const userObj = {
      userId: user.id || user._id,
      name: user.name || user.email,
    };

    // 💡 ข้อแนะนำเสริม: ตรวจสอบให้แน่ใจว่าไฟล์ src/doc/dto/create-doc.dto.ts 
    // มีการเพิ่มตัวแปร due_date?: string; และ publish_date?: string; ไว้แล้ว
    // สร้างงานได้เฉพาะในห้องของตัวเอง
    const dtos = Array.isArray(createDocDtos) ? createDocDtos : [createDocDtos];
    for (const roomId of new Set(dtos.map((d) => String(d.classroom)))) {
      assertOwnsRoom(user, await this.docService.findClassroom(roomId));
    }

    if (Array.isArray(createDocDtos)) {
      return this.docService.createMultiple(createDocDtos, userObj);
    } else {
      return this.docService.create(createDocDtos, userObj);
    }
  }

  // ===================================================
  // ✅ GET ALL ASSIGNMENTS
  // ===================================================
  // งานทุกชิ้นพร้อมคะแนนและ feedback ของนักศึกษาทุกคน
  // เดิม login ก็พอ นักศึกษาจึงอ่านคะแนนของเพื่อนได้ทั้งหมด
  // นักศึกษาใช้ /classroom/my และ /assignment/my-scores แทน
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @Get()
  async findAll(@Req() req) {
    // ครูเห็นเฉพาะงานในห้องของตัวเอง admin เห็นทั้งหมด
    if (req.user?.role === 'ADMIN') return this.docService.findAll();
    return this.docService.findForTeacher(userIdOf(req.user) ?? '');
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
  // ✅ คะแนนและ feedback ของนักศึกษาคนที่ login
  // ===================================================
  //
  // ต้องประกาศก่อน :id ไม่อย่างนั้น Nest จะอ่าน my-scores เป็น id
  @UseGuards(JwtAuthGuard)
  @Get('my-scores')
  async findMyScores(@Request() req) {
    const user = req.user;
    const userId = user._id || user.id || user.userId || user.sub;

    return this.docService.findMyScores(userId);
  }

  // ===================================================
  // ✅ ครูให้คะแนนและเขียน feedback
  // ===================================================
  //
  // ฟิลด์พวกนี้มีในฐานข้อมูลมานานแล้ว แต่ไม่มีเส้นไหนเขียนลงไปได้
  // ครูจึงรับงานได้อย่างเดียว ให้คะแนนหรือตอบกลับไม่ได้เลย
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @Patch(':id/students/:studentId/grade')
  async gradeStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Body() body: GradeStudentDto,
    @Request() req,
  ) {
    // ให้คะแนนได้เฉพาะงานในห้องของตัวเอง
    assertOwnsAssignment(req.user, await this.docService.findOneById(id));
    return this.docService.gradeStudent(id, studentId, body, req.user?.email);
  }

  // ===================================================
  // ✅ UPDATE ASSIGNMENT (📅 แก้ไขรองรับวันที่กำหนดส่ง)
  // ===================================================
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Param('id') id: string,
    // 🔍 ขยายขอบเขต Body ให้ดักรับฟิลด์วันที่เพิ่มเติม
    @Body()
    body: {
      assignment_name?: string;
      due_date?: string;
      publish_date?: string;
      max_score?: number;
    },
    @Request() req,
  ) {
    const user = req.user;
    const role = user.role;
    const userId = user._id || user.id || user.userId || user.sub;

    const assignment = await this.docService.findOneById(id);

    // เดิมครูทุกคนผ่านเงื่อนไขนี้ แก้งานของครูคนอื่นได้
    // ตอนนี้ต้องเป็นเจ้าของห้องหรือคนสร้างงาน ไม่งั้นต้องเป็น admin
    if (role !== 'ADMIN' && role !== 'TEACHER' && assignment.user_id !== userId) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์แก้ไข assignment นี้');
    }
    assertOwnsAssignment(user, assignment);

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
    // ครูตั้งคะแนนเต็มตอนสร้างงาน แต่ต้องแก้ทีหลังได้ด้วย
    if (body.max_score !== undefined) {
      updateData.max_score = body.max_score === null ? null : Number(body.max_score);
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
    assertOwnsAssignment(user, assignment);

    return this.docService.delete(id);
  }
}