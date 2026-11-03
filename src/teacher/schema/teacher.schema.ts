import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Category } from '../../shared/enums/category.enum';

export enum UserRole {
    TEACHER = 'TEACHER',
}

@Schema({ timestamps: true })
export class Teacher extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ 
    type: String, 
    enum: UserRole, 
    default: UserRole.TEACHER 
  })
  role: UserRole;

  // ความเชี่ยวชาญของครู ใช้จับคู่กับ category ของนักเรียน
  @Prop({
    type: String,
    enum: Category,
    index: true,
  })
  category?: Category;

  // บัญชีครูอยู่ถาวร ไม่ผูกกับปีการศึกษา ไม่ต้องสมัครใหม่ทุกเทอม
  @Prop({ default: true })
  isActive: boolean;

}
export const TeacherSchema = SchemaFactory.createForClass(Teacher);
