// src/file/file-storage.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types, mongo } from 'mongoose';
import * as fs from 'fs';
import { Readable } from 'stream';

/**
 * เก็บตัวไฟล์ที่อัปโหลดไว้ใน MongoDB (GridFS) แทนดิสก์ของเซิร์ฟเวอร์
 *
 * เดิมไฟล์ถูกเขียนลงโฟลเดอร์ uploads บนเครื่องที่รัน API
 * Render free tier ล้างดิสก์ทุกครั้งที่ deploy หรือรีสตาร์ท
 * งานที่นักศึกษาส่งจึงหายเงียบ ๆ ทั้งที่ record ใน collection files ยังอยู่
 *
 * GridFS เก็บไฟล์ในฐานข้อมูลเดิม (bucket ชื่อ uploads
 * คือ collection uploads.files และ uploads.chunks) ไม่ต้องสมัครบริการเพิ่ม
 *
 * ไฟล์เก่าที่อัปโหลดก่อนเปลี่ยนยังอ่านจากดิสก์ได้ถ้ายังไม่ถูกล้าง
 * แยกด้วยฟิลด์ gridfs_id ใน record ของไฟล์
 */
export const GRIDFS_BUCKET = 'uploads';

export type StoredFileRef = {
  gridfs_id?: string | null;
  file_path?: string | null;
};

@Injectable()
export class FileStorageService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private bucket() {
    return new mongo.GridFSBucket(this.connection.db as any, {
      bucketName: GRIDFS_BUCKET,
    });
  }

  /** เขียนไฟล์จาก memory ลง GridFS คืน id ของไฟล์ที่เก็บ */
  async save(
    buffer: Buffer,
    filename: string,
    metadata: Record<string, unknown>,
  ): Promise<string> {
    const upload = this.bucket().openUploadStream(filename, {
      metadata: { ...metadata },
    });

    await new Promise<void>((resolve, reject) => {
      Readable.from(buffer)
        .pipe(upload)
        .on('error', reject)
        .on('finish', () => resolve());
    });

    return String(upload.id);
  }

  /** ไฟล์นี้ยังอ่านได้ไหม ใช้ก่อนเปิด stream เพื่อตอบ 404 ให้ถูก */
  async exists(ref: StoredFileRef): Promise<boolean> {
    if (ref.gridfs_id) {
      if (!Types.ObjectId.isValid(ref.gridfs_id)) return false;
      const found = await this.bucket()
        .find({ _id: new Types.ObjectId(ref.gridfs_id) as any })
        .limit(1)
        .toArray();
      return found.length > 0;
    }

    return !!ref.file_path && fs.existsSync(ref.file_path);
  }

  /** เปิดอ่านไฟล์ จาก GridFS ถ้ามี ไม่อย่างนั้นลองจากดิสก์ (ไฟล์เก่า) */
  async open(ref: StoredFileRef): Promise<Readable> {
    if (!(await this.exists(ref))) {
      throw new NotFoundException('ไฟล์ไม่พบหรือถูกลบไปแล้ว');
    }

    if (ref.gridfs_id) {
      return this.bucket().openDownloadStream(
        new Types.ObjectId(ref.gridfs_id) as any,
      );
    }

    return fs.createReadStream(ref.file_path as string);
  }

  /** ลบตัวไฟล์ ไม่ throw ถ้าไม่มีอยู่แล้ว เพื่อให้ลบ record ต่อได้ */
  async remove(ref: StoredFileRef): Promise<void> {
    try {
      if (ref.gridfs_id && Types.ObjectId.isValid(ref.gridfs_id)) {
        await this.bucket().delete(new Types.ObjectId(ref.gridfs_id) as any);
        return;
      }

      if (ref.file_path && fs.existsSync(ref.file_path)) {
        fs.unlinkSync(ref.file_path);
      }
    } catch (err) {
      console.error('ลบตัวไฟล์ไม่สำเร็จ:', (err as Error).message);
    }
  }
}
