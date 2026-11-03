import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = User & Document;

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
}

// สถานะการอนุมัติบัญชี admin ต้องกด accept ก่อนถึงจะ login ได้
export enum AccountStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Schema({
  timestamps: true,
})
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  // ✅ email unique จริง
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: String,
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  // OTP reset password
  @Prop()
  resetOtp?: string;

  @Prop()
  resetOtpExpires?: Date;

  // ยืนยันอีเมล ต้องกดลิงก์ในเมลก่อนถึงจะ login ได้
  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ index: true })
  verifyToken?: string;

  @Prop()
  verifyTokenExpires?: Date;

  // รออนุมัติจาก admin
  @Prop({
    type: String,
    enum: AccountStatus,
    default: AccountStatus.PENDING,
    index: true,
  })
  status: AccountStatus;

  @Prop()
  approvedBy?: string;

  @Prop()
  approvedAt?: Date;

  // สาขาของสถานประกอบการที่ไปฝึก ใช้จับคู่กับความเชี่ยวชาญของครู
  @Prop({ trim: true, index: true })
  category?: string;

  // ปีการศึกษาไม่ได้อยู่กับ user แล้ว ย้ายไปเป็นของ classroom
  // คงฟิลด์ไว้แบบไม่บังคับเพื่อไม่ให้ข้อมูลเดิมพัง
  @Prop()
  academicYear?: string;

  // บังคับเฉพาะนักเรียน ครูกับ admin ไม่มีสาขาเรียนและรหัสนักศึกษา
  @Prop({
    required: function (this: any) {
      return this.role === UserRole.USER;
    },
  })
  major?: string;

  // ⭐⭐⭐ สำคัญสุด
  @Prop({
    required: function (this: any) {
      return this.role === UserRole.USER;
    },
    unique: true,
    sparse: true,
    trim: true,
  })
  student_id?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// unique index ประกาศไว้ที่ @Prop แล้ว
// ถ้าประกาศซ้ำที่นี่ mongoose จะเตือน Duplicate schema index ทุกครั้งที่ boot

//
// ✅ HASH PASSWORD
//
UserSchema.pre<UserDocument>('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});