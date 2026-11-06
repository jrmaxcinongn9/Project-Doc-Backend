import { IsEmail, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SupportStatus, SupportTopic } from '../support.schema';

export class CreateSupportDto {
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกชื่อ' })
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  email: string;

  @IsOptional()
  @IsEnum(SupportTopic, { message: 'หัวข้อไม่ถูกต้อง' })
  topic?: SupportTopic;

  @IsString()
  @MinLength(10, { message: 'กรุณาเล่ารายละเอียดอย่างน้อย 10 ตัวอักษร' })
  @MaxLength(3000, { message: 'รายละเอียดยาวเกินไป' })
  message: string;
}

export class ReplySupportDto {
  @IsString()
  @MinLength(2, { message: 'กรุณาพิมพ์คำตอบ' })
  @MaxLength(3000)
  message: string;

  // ตอบแล้วปิดเรื่องไปพร้อมกัน
  @IsOptional()
  resolve?: boolean;
}

export class UpdateSupportDto {
  @IsIn([SupportStatus.OPEN, SupportStatus.RESOLVED])
  status: SupportStatus;
}
