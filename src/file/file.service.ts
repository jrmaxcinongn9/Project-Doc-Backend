// src/file/file.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FileEntity, FileDocument } from './schema/file.schema';
import * as fs from 'fs';
import { extname } from 'path';
import * as archiver from 'archiver';
import { Response } from 'express';

interface UploaderInfo {
  userId: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  studentId?: string | null;
  groupId?: string | null;
  assignmentId?: string | null;
}

@Injectable()
export class FileService {
  constructor(
    @InjectModel(FileEntity.name)
    private readonly fileModel: Model<FileDocument>,
  ) {}

  // ----------------------- Create -----------------------
  async create(file: Express.Multer.File, uploader: UploaderInfo) {
    if (!uploader.userId) {
      throw new BadRequestException('ไม่พบ userId ของผู้อัปโหลด');
    }

    const now = new Date();
    const upload_year = String(now.getFullYear());
    const upload_month = String(now.getMonth() + 1).padStart(2, '0');
    const upload_day = String(now.getDate()).padStart(2, '0');

    const fileType = file.mimetype.split('/')[0];

    const doc = new this.fileModel({
      file_id: file.filename,
      file_name: file.filename,
      original_name: file.originalname,
      file_path: file.path,
      file_type: fileType,
      mimetype: file.mimetype,
      file_size: file.size,

      uploaded_by: uploader.email || uploader.userId,
      uploaded_by_id: uploader.userId,
      uploaded_by_name: uploader.name || undefined,
      uploaded_by_email: uploader.email || undefined,
      uploaded_by_role: uploader.role || undefined,

      student_id: uploader.studentId || undefined,
      group_id: uploader.groupId || undefined,
      assignment_id: uploader.assignmentId || undefined,

      upload_year,
      upload_month,
      upload_day,
    });

    return doc.save();
  }

  // ----------------------- Find -----------------------
  async findAll() {
    return this.fileModel.find().sort({ createdAt: -1 }).exec();
  }

  async findByUploaderId(uploaderId: string) {
    return this.fileModel.find({ uploaded_by_id: uploaderId }).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const file = await this.fileModel.findById(id).exec();
    if (!file) throw new NotFoundException('ไม่พบไฟล์');
    return file;
  }

  async findByAssignmentId(assignmentId: string) {
    return this.fileModel.find({ assignment_id: assignmentId }).sort({ createdAt: -1 }).exec();
  }

  async findSubmittersByAssignment(assignmentId: string) {
    return this.fileModel.aggregate([
      { $match: { assignment_id: assignmentId } },
      {
        $group: {
          _id: '$uploaded_by_id',
          uploaded_by_id: { $first: '$uploaded_by_id' },
          uploaded_by_email: { $first: '$uploaded_by_email' },
          student_id: { $first: '$student_id' },
        },
      },
    ]).exec();
  }

  // ----------------------- Update -----------------------
  async update(
    id: string,
    dto: Partial<{ original_name?: string; group_id?: string; assignment_id?: string }>,
    userId: string,
    role?: string,
  ) {
    const file = await this.fileModel.findById(id);
    if (!file) throw new NotFoundException('ไม่พบไฟล์');

    // ✅ permission check
    if (file.uploaded_by_id !== userId && role !== 'ADMIN' && role !== 'TEACHER') {
      throw new ForbiddenException('ไม่มีสิทธิ์แก้ไขไฟล์นี้');
    }

    if (dto.original_name !== undefined) file.original_name = dto.original_name;
    if (dto.group_id !== undefined) file.group_id = dto.group_id;
    if (dto.assignment_id !== undefined) file.assignment_id = dto.assignment_id;

    return file.save();
  }

  // ----------------------- Remove -----------------------
 async remove(id: string, userId: string, role?: string) {
  const file = await this.fileModel.findById(id);
  if (!file) throw new NotFoundException('ไม่พบไฟล์');

  // ตรวจสอบสิทธิ์: เจ้าของไฟล์, ADMIN, TEACHER
  if (file.uploaded_by_id !== userId && role !== 'ADMIN' && role !== 'TEACHER') {
    throw new ForbiddenException('ไม่มีสิทธิ์ลบไฟล์นี้');
  }

  // ลบไฟล์จากดิสก์
  if (file.file_path && fs.existsSync(file.file_path)) {
    try {
      fs.unlinkSync(file.file_path);
    } catch (err) {
      console.error('ลบไฟล์ในดิสก์ไม่สำเร็จ:', err);
    }
  }

  // ลบ record ใน MongoDB
  await this.fileModel.deleteOne({ _id: id }).exec();
  return { message: 'ลบไฟล์เรียบร้อยแล้ว' };
}

  // ----------------------- Download Single File -----------------------
  async downloadFile(id: string, userId: string, role?: string, res?: Response) {
    const file = await this.findOne(id);
    if (file.uploaded_by_id !== userId && role !== 'ADMIN' && role !== 'TEACHER') {
      throw new ForbiddenException('ไม่มีสิทธิ์ดาวน์โหลดไฟล์นี้');
    }

    if (!file.file_path || !fs.existsSync(file.file_path)) {
      throw new NotFoundException('ไฟล์ไม่พบหรือถูกลบไปแล้ว');
    }

    if (res) {
      res.download(file.file_path, file.original_name || file.file_name, (err) => {
        if (err) res.status(500).send('เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์');
      });
    } else {
      return file.file_path;
    }
  }

  // ----------------------- Download Multiple Files as ZIP -----------------------
  async downloadZip(ids: string[], userId: string, role: string, res: Response) {
    const files = await Promise.all(ids.map(id => this.findOne(id)));
    const existingFiles = files.filter(f => f.file_path && fs.existsSync(f.file_path));
    if (existingFiles.length === 0) throw new NotFoundException('ไม่พบไฟล์ที่สามารถดาวน์โหลดได้');

    for (const file of existingFiles) {
      if (file.uploaded_by_id !== userId && role !== 'ADMIN' && role !== 'TEACHER') {
        throw new ForbiddenException('ไม่มีสิทธิ์ดาวน์โหลดไฟล์บางไฟล์ในรายการ');
      }
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=files.zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => res.status(500).send('เกิดข้อผิดพลาดในการสร้าง ZIP'));
    archive.pipe(res);

    existingFiles.forEach(file => {
      archive.append(fs.createReadStream(file.file_path), { name: file.original_name || file.file_name });
    });

    await archive.finalize();
  }
}