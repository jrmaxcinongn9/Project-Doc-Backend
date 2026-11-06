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
import { extname } from 'path';
import * as archiver from 'archiver';
import { FileStorageService } from './file-storage.service';
import { Response } from 'express';

// ชนิดไฟล์ที่เปิดดูในเบราว์เซอร์ได้อย่างปลอดภัย ไม่มีสคริปต์
export const PREVIEWABLE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
];

export function isPreviewable(mimetype?: string | null) {
  return !!mimetype && PREVIEWABLE_TYPES.includes(mimetype.split(';')[0].trim().toLowerCase());
}

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
    private readonly storage: FileStorageService,
  ) {}

  // ตั้งชื่อไฟล์ที่เก็บ ไม่ใช้ชื่อเดิมของผู้ใช้ตรง ๆ เพราะชนกันได้
  private storedName(file: Express.Multer.File, uploader: UploaderInfo) {
    const owner = String(uploader.studentId || uploader.userId).replace(/[^a-zA-Z0-9]/g, '_');
    const random = Math.round(Math.random() * 1e9);
    return `${owner}-${Date.now()}-${random}${extname(file.originalname)}`;
  }

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
    const storedName = this.storedName(file, uploader);

    // เก็บตัวไฟล์ลงฐานข้อมูล ไม่ใช่ดิสก์ของ Render ที่ล้างทุกครั้งที่ deploy
    const gridfsId = await this.storage.save(file.buffer, storedName, {
      original_name: file.originalname,
      mimetype: file.mimetype,
      uploaded_by_id: uploader.userId,
      assignment_id: uploader.assignmentId || null,
    });

    const doc = new this.fileModel({
      file_id: storedName,
      file_name: storedName,
      original_name: file.originalname,
      file_path: `gridfs:${gridfsId}`,
      gridfs_id: gridfsId,
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

    try {
      return await doc.save();
    } catch (err) {
      // record บันทึกไม่ได้ ไม่อยากทิ้งไฟล์กำพร้าไว้ใน GridFS
      await this.storage.remove({ gridfs_id: gridfsId });
      throw err;
    }
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

  async findByAssignmentIds(assignmentIds: string[]) {
    return this.fileModel.find({ assignment_id: { $in: assignmentIds } }).sort({ createdAt: -1 }).exec();
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

  // ลบตัวไฟล์ ทั้งใน GridFS และไฟล์เก่าบนดิสก์
  await this.storage.remove(file);

  // ลบ record ใน MongoDB
  await this.fileModel.deleteOne({ _id: id }).exec();
  return { message: 'ลบไฟล์เรียบร้อยแล้ว' };
}

  // ----------------------- Download Single File -----------------------
  async downloadFile(
    id: string,
    userId: string,
    role: string | undefined,
    res: Response,
    inline = false,
  ) {
    const file = await this.findOne(id);
    if (file.uploaded_by_id !== userId && role !== 'ADMIN' && role !== 'TEACHER') {
      throw new ForbiddenException('ไม่มีสิทธิ์ดาวน์โหลดไฟล์นี้');
    }

    const stream = await this.storage.open(file);

    // attachment ใส่ชื่อไฟล์ภาษาไทยแบบ RFC 5987 ให้เอง
    res.attachment(file.original_name || file.file_name);
    res.type(file.mimetype || 'application/octet-stream');

    // เปิดดูในเบราว์เซอร์ได้เฉพาะชนิดที่ไม่มีสคริปต์ฝังอยู่
    // HTML หรือ SVG ที่นักศึกษาอัปโหลดมา ถ้าเปิดแบบ inline จะรันสคริปต์บนโดเมนของเว็บได้
    // ชนิดอื่นยังดาวน์โหลดเหมือนเดิม
    if (inline && isPreviewable(file.mimetype)) {
      const header = String(res.getHeader('Content-Disposition') ?? '');
      res.setHeader('Content-Disposition', header.replace(/^attachment/, 'inline'));
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');

    stream.on('error', () => {
      if (!res.headersSent) res.status(500).send('เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์');
      else res.end();
    });
    stream.pipe(res);
  }

  // ----------------------- Download Multiple Files as ZIP -----------------------
  async downloadZip(ids: string[], userId: string, role: string, res: Response) {
    const files = await Promise.all(ids.map(id => this.findOne(id)));

    for (const file of files) {
      if (file.uploaded_by_id !== userId && role !== 'ADMIN' && role !== 'TEACHER') {
        throw new ForbiddenException('ไม่มีสิทธิ์ดาวน์โหลดไฟล์บางไฟล์ในรายการ');
      }
    }

    const available: FileDocument[] = [];
    for (const file of files) {
      if (await this.storage.exists(file)) available.push(file);
    }
    if (available.length === 0) throw new NotFoundException('ไม่พบไฟล์ที่สามารถดาวน์โหลดได้');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=files.zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', () => res.status(500).send('เกิดข้อผิดพลาดในการสร้าง ZIP'));
    archive.pipe(res);

    for (const file of available) {
      archive.append(await this.storage.open(file), { name: file.original_name || file.file_name });
    }

    await archive.finalize();
  }
}
