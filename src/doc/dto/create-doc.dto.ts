// src/doc/dto/create-doc.dto.ts
import {
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  // คะแนนเต็มของงานชิ้นนี้ ครูกรอกตอนสร้างงานตามที่อาจารย์สั่ง
  // ไม่กรอกก็ได้ งานบางชิ้นไม่ได้คิดคะแนน
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'max_score ต้องเป็นจำนวนเต็ม' })
  @Min(1, { message: 'max_score ต้องมากกว่า 0' })
  @Max(1000, { message: 'max_score สูงเกินไป' })
  max_score?: number;
}