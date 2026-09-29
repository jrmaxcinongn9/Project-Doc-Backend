// src/doc/dto/create-doc.dto.ts
import { IsNotEmpty, IsString, IsMongoId, IsOptional } from 'class-validator';

export class CreateDocDto {

  @IsNotEmpty()
  @IsString()
  assignment_name: string;

  // ✅ classroom ที่ assignment อยู่
  @IsNotEmpty()
  @IsMongoId()
  classroom: string;

  // 📅 เพิ่มฟิลด์วันที่เริ่มต้น และวันสิ้นสุดกำหนดส่งตรงนี้ครับ
  @IsOptional()
  @IsString()
  publish_date?: string;

  @IsOptional()
  @IsString()
  due_date?: string;
}