// src/file/file.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Param,
  Body,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Req,
  ForbiddenException,
  Query,
  Res,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/schema/user.schema';
import { assertOwnsAssignment, ownsAssignment, userIdOf } from '../shared/ownership';
import { memoryStorage } from 'multer';
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { DocService } from '../doc/doc.service';
import { UpdateFileDto } from './dto/update-file.dto';

type AuthedRequest = Request & {
  user?: {
    id?: string;
    _id?: string;
    userId?: string;
    uid?: string;
    email?: string;
    name?: string;
    username?: string;
    role?: string;
  };
};

@Controller('files')
export class FileController {
  constructor(
    private readonly fileService: FileService,
    private readonly docService: DocService,
  ) { }

  // ----------------------- Upload -----------------------
  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: 5 * 1024 * 1024 },
      // ค่าปริยายของ multer อ่านชื่อไฟล์เป็น latin1 ชื่อภาษาไทยจึงเพี้ยน
      // เช่น รายงาน.pdf กลายเป็น à¸£à¸²... ทั้งในฐานข้อมูลและตอนดาวน์โหลด
      defParamCharset: 'utf8',
      // เก็บไว้ใน memory ก่อน แล้ว FileService เขียนลง GridFS
      // ห้ามกลับไปใช้ diskStorage ดิสก์ของ Render ถูกล้างทุกครั้งที่ deploy
      storage: memoryStorage(),
      // type ของ Nest ยังไม่มี defParamCharset แต่ multer 2 รองรับแล้ว
    } as MulterOptions & { defParamCharset: string }),
  )
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('studentId') studentId: string,
    @Body('assignmentId') assignmentId: string,
    @Req() req: AuthedRequest,
  ) {
    if (!files || files.length === 0) throw new BadRequestException('กรุณาเลือกไฟล์');
    if (!assignmentId) throw new BadRequestException('ต้องเลือก assignment ก่อนอัปโหลดไฟล์');
    if (!Types.ObjectId.isValid(assignmentId)) throw new BadRequestException('รูปแบบ assignmentId ไม่ถูกต้อง');

    const assignment = await this.docService.findOneById(assignmentId);
    if (!assignment) throw new BadRequestException('ไม่พบ assignment นี้ในระบบ');

    // --- จุดสำคัญที่ทำให้เกิด Error "ไม่พบ userId" ---
    const user = req.user;
    // ปรับให้ดึงจากหลายที่ เผื่อใน Token เก็บคนละชื่อ
    const currentUserId = user?.userId || user?.id || user?._id || user?.uid;

    if (!user || !currentUserId) {
      console.log('User object from Token:', user); // ดูในหน้าจอ NestJS ว่ามีค่าอะไรหลุดมาบ้าง
      throw new BadRequestException('ไม่พบ userId ในระบบ Token');
    }

    if (user.role === 'STUDENT' && !studentId) throw new BadRequestException('ต้องระบุ studentId');

    // นักศึกษาส่งงานได้เฉพาะงานในห้องที่ตัวเองอยู่
    // เดิมรู้ id ของงานห้องไหนก็ส่งไฟล์เข้าไปได้
    if (user.role === 'USER') {
      const room: any = (assignment as any).classroom;
      const members: string[] = (room?.students ?? []).map((s: any) => String(s?._id ?? s));

      if (!members.includes(String(currentUserId))) {
        throw new ForbiddenException('คุณไม่ได้อยู่ในห้องเรียนของงานชิ้นนี้');
      }
    }

    const uploader = {
      userId: currentUserId, // ใช้ค่าที่ดึงมาใหม่
      email: user.email || null,
      name: user.name || null,
      role: user.role || null,
      studentId: studentId || null,
      assignmentId: assignmentId || null,
    };

    const results = await Promise.all(files.map((file) => this.fileService.create(file, uploader)));

    return {
      message: `อัปโหลดสำเร็จ (${results.length} ไฟล์)`,
      uploadedBy: { userId: uploader.userId, email: uploader.email },
      assignmentId: uploader.assignmentId,
      files: results,
    };
  }
  // ----------------------- List -----------------------
  // ไฟล์ของทั้งระบบ เฉพาะครูและ admin นักศึกษาใช้ /files/my
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @Get()
  async findAll(@Req() req: AuthedRequest) {
    // ครูเห็นเฉพาะไฟล์ในงานของห้องตัวเอง admin เห็นทั้งหมด
    if (req.user?.role === 'ADMIN') return this.fileService.findAll();
    const ids = await this.docService.teacherAssignmentIds(userIdOf(req.user as any) ?? '');
    return this.fileService.findByAssignmentIds(ids);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async findMyFiles(@Req() req: AuthedRequest) {
    // JwtStrategy คืน id ไว้ที่ _id เดิมอ่าน userId ซึ่งไม่มี เส้นนี้จึงตอบ 400 เสมอ
    const user = req.user;
    const uid = user?.userId || user?._id || user?.id || user?.uid;
    if (!uid) throw new BadRequestException('ไม่พบ userId ใน token');
    return this.fileService.findByUploaderId(uid);
  }

  @UseGuards(JwtAuthGuard)
  @Get('assignment/:assignmentId')
  async getFilesByAssignment(@Param('assignmentId') assignmentId: string, @Req() req: AuthedRequest) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'TEACHER') throw new ForbiddenException('อนุญาตเฉพาะ Admin และ Teacher');
    if (!Types.ObjectId.isValid(assignmentId)) throw new BadRequestException('รูปแบบ assignmentId ไม่ถูกต้อง');
    // ครูดูได้เฉพาะงานในห้องของตัวเอง
    assertOwnsAssignment(req.user as any, await this.docService.findOneById(assignmentId));
    return this.fileService.findByAssignmentId(assignmentId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('assignment/:assignmentId/submitters')
  async getSubmittersByAssignment(@Param('assignmentId') assignmentId: string, @Req() req: AuthedRequest) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'TEACHER') throw new ForbiddenException('อนุญาตเฉพาะ Admin และ Teacher');
    if (!Types.ObjectId.isValid(assignmentId)) throw new BadRequestException('รูปแบบ assignmentId ไม่ถูกต้อง');
    // ครูดูได้เฉพาะงานในห้องของตัวเอง
    assertOwnsAssignment(req.user as any, await this.docService.findOneById(assignmentId));
    return this.fileService.findSubmittersByAssignment(assignmentId);
  }

  // ครูเปิด แก้ หรือลบไฟล์ของนักศึกษาได้เฉพาะไฟล์ในงานของห้องตัวเอง
  // เจ้าของไฟล์และ admin ทำได้ตามเดิม
  private async assertCanAccessFile(id: string, user: AuthedRequest['user']) {
    const file = await this.fileService.findOne(id);
    const uid = userIdOf(user as any);

    if (user?.role === 'ADMIN' || (uid && file.uploaded_by_id === uid)) return;

    if (user?.role === 'TEACHER' && file.assignment_id && Types.ObjectId.isValid(file.assignment_id)) {
      const assignment = await this.docService.findOneById(file.assignment_id).catch(() => null);
      if (assignment && ownsAssignment(user as any, assignment)) return;
    }

    throw new ForbiddenException('ไฟล์นี้ไม่ได้อยู่ในงานของห้องเรียนคุณ');
  }

  // ----------------------- Update -----------------------
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateFile(@Param('id') id: string, @Body() dto: UpdateFileDto, @Req() req: AuthedRequest) {
    const user = req.user;
    const uid = userIdOf(user as any);
    if (!uid) throw new BadRequestException('ไม่พบ userId');
    await this.assertCanAccessFile(id, user);
    return this.fileService.update(id, dto, uid, user?.role ?? 'STUDENT');
  }

  // ----------------------- Download ZIP -----------------------
  // ต้องประกาศก่อน download/:id ไม่อย่างนั้น Nest อ่าน zip เป็น id ของไฟล์
  @UseGuards(JwtAuthGuard)
  @Get('download/zip')
  async downloadZip(@Query('ids') ids: string, @Res() res: Response, @Req() req: AuthedRequest) {
    const user = req.user;
    const uid = user?.userId || user?._id || user?.id || user?.uid;
    if (!uid) throw new BadRequestException('ไม่พบ userId');

    const role = user?.role ?? 'USER';

    const idArray = String(ids ?? '').split(',').filter((id) => Types.ObjectId.isValid(id));
    if (idArray.length === 0) throw new BadRequestException('ไม่มีไฟล์ให้ดาวน์โหลด');

    for (const fileId of idArray) {
      await this.assertCanAccessFile(fileId, user);
    }

    await this.fileService.downloadZip(idArray, uid, role, res);
  }

  // ----------------------- Download Single -----------------------
  @UseGuards(JwtAuthGuard)
  @Get('download/:id')
  async downloadFile(
    @Param('id') id: string,
    @Query('inline') inline: string,
    @Res() res: Response,
    @Req() req: AuthedRequest,
  ) {
    const user = req.user;
    const uid = user?.userId || user?._id || user?.id || user?.uid;
    if (!uid) throw new BadRequestException('ไม่พบ userId');

    await this.assertCanAccessFile(id, user);

    // ?inline=1 ให้ครูเปิดดูไฟล์ในเบราว์เซอร์ได้เลย ไม่ต้องดาวน์โหลดก่อน
    await this.fileService.downloadFile(id, uid, user?.role ?? 'USER', res, inline === '1');
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async removeFile(@Param('id') id: string, @Req() req: AuthedRequest) {
    const user = req.user;

    const uid =
      user?.userId ||
      user?._id ||
      user?.id ||
      user?.uid;

    if (!uid) {
      throw new BadRequestException('ไม่พบ userId');
    }

    const role = user?.role ?? 'USER';

    await this.assertCanAccessFile(id, user);
    return this.fileService.remove(id, uid, role);
  }
} 