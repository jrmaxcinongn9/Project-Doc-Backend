import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = User & Document;

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
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

  @Prop({ required: true })
  academicYear: string;

  @Prop({ required: true })
  major: string;

  // ⭐⭐⭐ สำคัญสุด
  @Prop({
    required: true,
    unique: true,
    trim: true,
    index: true,
  })
  student_id: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

//
// ✅ FORCE UNIQUE INDEX (สำคัญมาก)
//
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ student_id: 1 }, { unique: true });

//
// ✅ HASH PASSWORD
//
UserSchema.pre<UserDocument>('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});