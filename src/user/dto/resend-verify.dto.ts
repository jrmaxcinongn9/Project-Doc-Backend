import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * ขอลิงก์ยืนยันใหม่ด้วยตัวเอง
 *
 * ต้องมีรหัสผ่าน เพราะลิงก์ยืนยันคือกุญแจของบัญชีนั้น
 * ถ้าขอด้วยอีเมลอย่างเดียว ใครก็ยืนยันอีเมลแทนคนอื่นได้
 */
export class ResendVerifyDTO {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
