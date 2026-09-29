import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocDocument = DocEntity & Document;

@Schema({ collection: 'docs', timestamps: true })
export class DocEntity {

  @Prop({ required: true })
  assignment_name: string;

  // ✅ classroom
  @Prop({
    type: Types.ObjectId,
    ref: 'Classroom',
    required: true,
  })
  classroom: Types.ObjectId;

  // ✅ คนสร้าง
  @Prop({ required: true })
  user_id: string;

  @Prop()
  user_name?: string;

  // ==========================================
  // 📅 เพิ่มฟิลด์วันที่เริ่มต้น และ วันสิ้นสุดกำหนดส่ง ตรงนี้ครับ
  // ==========================================
  @Prop({ type: Date, default: null })
  publish_date: Date;

  @Prop({ type: Date, default: null })
  due_date: Date;

  // ================================
  // ✅ ⭐ เพิ่มตรงนี้
  // รายชื่อนักเรียนใน assignment
  // ================================
  @Prop([
    {
      student_id: {
        type: Types.ObjectId,
        ref: 'User',
      },
      name: String,
      status: {
        type: String,
        default: 'PENDING',
      },
    },
  ])
  students: {
    student_id: Types.ObjectId;
    name: string;
    status: string;
  }[];
}

export const DocSchema = SchemaFactory.createForClass(DocEntity);