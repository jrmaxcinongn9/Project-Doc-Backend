// src/file/schema/file.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FileDocument = FileEntity & Document;

@Schema({
  collection: 'files',
  timestamps: true, // ✅ ใช้ createdAt, updatedAt
})
export class FileEntity {
  @Prop({ required: true, unique: true })
  file_id: string;

  @Prop({ required: true })
  file_name: string;

  @Prop({ required: true })
  original_name: string;

  @Prop({ required: true })
  file_path: string;

  @Prop({ required: true })
  file_type: string;

  @Prop({ required: true })
  mimetype: string;

  @Prop({ required: true })
  file_size: number;

  // ❌ ลบ uploaded_at ออก

  @Prop()
  uploaded_by?: string;

  @Prop({ required: true, index: true })
  uploaded_by_id: string;

  @Prop()
  uploaded_by_name?: string;

  @Prop()
  uploaded_by_email?: string;

  @Prop()
  uploaded_by_role?: string;

  @Prop({ index: true })
  student_id?: string;

  @Prop({ index: true })
  group_id?: string;

  @Prop({ index: true })
  assignment_id?: string;

  // ✅ ใช้สำหรับ filter วันที่
  @Prop()
  upload_day: string;

  @Prop()
  upload_month: string;

  @Prop()
  upload_year: string;
}

export const FileSchema = SchemaFactory.createForClass(FileEntity);