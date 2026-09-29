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
  NotFoundException,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Request, Response } from 'express';
import * as fs from 'fs';
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
      storage: diskStorage({
        destination: (req: AuthedRequest, file, cb) => {
          const studentId = (req.body as any)?.studentId;
          const rawUser = req.user;
          // แก้ไข: ดึงค่า ID ให้ครอบคลุมทุกโอกาส
          const userId = rawUser?.userId || rawUser?.id || rawUser?._id || rawUser?.uid || 'unknown';
          const folderOwner = studentId || userId;
          const safeUser = String(folderOwner).replace(/[^a-zA-Z0-9]/g, '_');

          const now = new Date();
          const year = String(now.getFullYear());
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const type = file.mimetype.split('/')[0];

          // ใช้งาน path.join ข้ามแพลตฟอร์ม (Windows, Mac, Linux/Render)
          const uploadPath = join(process.cwd(), 'uploads', safeUser, year, month, day, type);

          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }

          cb(null, uploadPath);
        },
        filename: (req: AuthedRequest, file, cb) => {
          const studentId = (req.body as any)?.studentId;
          const rawUser = req.user;
          const fromUser = rawUser?.userId || rawUser?.id || rawUser?._id || rawUser?.uid || 'unknown';
          const uploader = studentId || fromUser;
          const ext = extname(file.originalname);
          const timestamp = Date.now();
          const random = Math.round(Math.random() * 1e9);
          cb(null, `${uploader}-${timestamp}-${random}${ext}`);
        },
      }),
    }),
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
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    return this.fileService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async findMyFiles(@Req() req: AuthedRequest) {
    const user = req.user;
    if (!user || !user.userId) throw new BadRequestException('ไม่พบ userId ใน token');
    return this.fileService.findByUploaderId(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('assignment/:assignmentId')
  async getFilesByAssignment(@Param('assignmentId') assignmentId: string, @Req() req: AuthedRequest) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'TEACHER') throw new ForbiddenException('อนุญาตเฉพาะ Admin และ Teacher');
    if (!Types.ObjectId.isValid(assignmentId)) throw new BadRequestException('รูปแบบ assignmentId ไม่ถูกต้อง');
    return this.fileService.findByAssignmentId(assignmentId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('assignment/:assignmentId/submitters')
  async getSubmittersByAssignment(@Param('assignmentId') assignmentId: string, @Req() req: AuthedRequest) {
    const role = req.user?.role;
    if (role !== 'ADMIN' && role !== 'TEACHER') throw new ForbiddenException('อนุญาตเฉพาะ Admin และ Teacher');
    if (!Types.ObjectId.isValid(assignmentId)) throw new BadRequestException('รูปแบบ assignmentId ไม่ถูกต้อง');
    return this.fileService.findSubmittersByAssignment(assignmentId);
  }

  // ----------------------- Update -----------------------
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateFile(@Param('id') id: string, @Body() dto: UpdateFileDto, @Req() req: AuthedRequest) {
    const user = req.user;
    if (!user || !user.userId) throw new BadRequestException('ไม่พบ userId');
    return this.fileService.update(id, dto, user.userId, user.role ?? 'STUDENT');
  }

  // ----------------------- Download Single -----------------------
  @UseGuards(JwtAuthGuard)
  @Get('download/:id')
  async downloadFile(@Param('id') id: string, @Res() res: Response, @Req() req: AuthedRequest) {
    const user = req.user;
    const uid = user?.userId || user?._id || user?.id || user?.uid;
    if (!uid) throw new BadRequestException('ไม่พบ userId');

    const role = user?.role ?? 'USER';

    const file = await this.fileService.findOne(id);
    if (!file.file_path || !fs.existsSync(file.file_path))
      throw new NotFoundException('ไฟล์ไม่พบหรือถูกลบไปแล้ว');

    if (file.uploaded_by_id !== uid && role !== 'ADMIN' && role !== 'TEACHER') {
      throw new ForbiddenException('ไม่มีสิทธิ์ดาวน์โหลดไฟล์นี้');
    }

    res.download(file.file_path, file.original_name || file.file_name, (err) => {
      if (err) res.status(500).send('เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์');
    });
  }

  // ----------------------- Download ZIP -----------------------
  @UseGuards(JwtAuthGuard)
  @Get('download/zip')
  async downloadZip(@Query('ids') ids: string, @Res() res: Response, @Req() req: AuthedRequest) {
    const user = req.user;
    const uid = user?.userId || user?._id || user?.id || user?.uid;
    if (!uid) throw new BadRequestException('ไม่พบ userId');

    const role = user?.role ?? 'USER';

    const idArray = ids.split(',').filter((id) => Types.ObjectId.isValid(id));
    if (idArray.length === 0) throw new BadRequestException('ไม่มีไฟล์ให้ดาวน์โหลด');

    await this.fileService.downloadZip(idArray, uid, role, res);
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

    return this.fileService.remove(id, uid, role);
  }
} 