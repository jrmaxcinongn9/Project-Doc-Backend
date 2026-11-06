import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SupportTicketDocument = SupportTicket & Document;

export enum SupportTopic {
  ACCOUNT = 'ACCOUNT',       // สมัคร ยืนยันอีเมล รออนุมัติ รหัสผ่าน
  CLASSROOM = 'CLASSROOM',   // ไม่เห็นห้อง สาขาวิชาผิด
  SUBMISSION = 'SUBMISSION', // ส่งงาน ไฟล์
  GRADE = 'GRADE',           // คะแนน ความเห็น
  OTHER = 'OTHER',
}

export enum SupportStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

/**
 * เรื่องที่ผู้ใช้แจ้งผ่านหน้า support
 * แจ้งได้แม้ยัง login ไม่ได้ เพราะปัญหาที่พบบ่อยที่สุดคือเข้าระบบไม่ได้
 */
@Schema({ collection: 'support_tickets', timestamps: true })
export class SupportTicket {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ type: String, enum: SupportTopic, default: SupportTopic.OTHER })
  topic: SupportTopic;

  @Prop({ required: true })
  message: string;

  @Prop({ type: String, enum: SupportStatus, default: SupportStatus.OPEN, index: true })
  status: SupportStatus;

  // คนแจ้งที่ login อยู่ ว่างได้
  @Prop()
  user_id?: string;

  @Prop()
  user_role?: string;

  @Prop({
    type: [{ by: String, message: String, at: Date, mailed: Boolean }],
    default: [],
  })
  replies: { by: string; message: string; at: Date; mailed: boolean }[];

  @Prop()
  resolvedBy?: string;

  @Prop()
  resolvedAt?: Date;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);
