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

  // คะแนนเต็มของงานชิ้นนี้ ครูกรอกตอนสร้างงาน
  @Prop({ type: Number, default: null, min: 0 })
  max_score: number;

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
      // คะแนนที่ครูให้ ต้องไม่เกิน max_score
      score: {
        type: Number,
        default: null,
        min: 0,
      },
      // ข้อความ feedback จากครู
      feedback: {
        type: String,
        default: null,
      },
      feedback_by: {
        type: String,
        default: null,
      },
      feedback_at: {
        type: Date,
        default: null,
      },
    },
  ])
  students: {
    student_id: Types.ObjectId;
    name: string;
    status: string;
    score: number | null;
    feedback: string | null;
    feedback_by: string | null;
    feedback_at: Date | null;
  }[];
}

export const DocSchema = SchemaFactory.createForClass(DocEntity);