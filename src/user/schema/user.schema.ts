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

  // ลิงก์เข้าสู่ระบบครั้งเดียว ส่งไปตอน admin อนุมัติ หรือคืนให้ตอนยืนยันอีเมลของบัญชีที่อนุมัติแล้ว
  @Prop({ index: true })
  loginToken?: string;

  @Prop()
  loginTokenExpires?: Date;

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

  // อีเมลของ admin ที่กดยืนยันอีเมลแทนผู้ใช้ ว่างไว้ถ้าผู้ใช้กดลิงก์เอง
  @Prop()
  verifiedBy?: string;

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

  // รูปโปรไฟล์ เก็บตัวรูปใน GridFS bucket avatars ที่นี่เก็บแค่ id
  @Prop()
  avatar_id?: string;

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
//
// ✅ ไม่ส่ง password ออกไปกับ response ใด ๆ
//
// GET /user ขอแค่ login ไม่ได้ดูบทบาท นักศึกษาคนไหนก็เรียกได้
// และเดิมมันคืนเอกสารทั้งก้อนรวม password ที่ผ่าน bcrypt มาแล้วด้วย
// นักศึกษาหนึ่งคนจึงดึง hash ของ admin และครูทุกคนออกไปได้
// bcrypt ถอดกลับตรง ๆ ไม่ได้ แต่เอาไปไล่เดารหัสออฟไลน์ได้ไม่จำกัดครั้ง
//
// ตัดทิ้งที่ระดับ schema ครั้งเดียว ครอบคลุมทุกเส้นที่คืน user ออกไป
// ดีกว่าไล่ใส่ select ทีละ query ซึ่งลืมได้ทุกครั้งที่เพิ่มเส้นใหม่
//
// การตรวจรหัสผ่านตอน login อ่านค่าจากตัว document ตรง ๆ ไม่ผ่านตรงนี้
// จึงยังทำงานได้ตามเดิม
const hidePassword = {
  transform: (_doc: any, ret: any) => {
    delete ret.password;
    return ret;
  },
};

UserSchema.set('toJSON', hidePassword);
UserSchema.set('toObject', hidePassword);
