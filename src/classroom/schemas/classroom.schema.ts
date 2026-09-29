// src/classroom/schemas/classroom.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Classroom {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, index: true })
  major: string;

  @Prop({ required: true, index: true })
  academicYear: string;

  @Prop({ required: true })
  level: number;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  students: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  // 🔹 เปลี่ยนจาก virtual เป็น Prop จริง
  @Prop({ type: [{ type: Types.ObjectId, ref: 'DocEntity' }], default: [] })
  assignments: Types.ObjectId[];
}

export const ClassroomSchema = SchemaFactory.createForClass(Classroom);