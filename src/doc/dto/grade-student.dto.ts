import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * ครูให้คะแนนและเขียน feedback ของนักศึกษาหนึ่งคนในงานหนึ่งชิ้น
 *
 * ทั้งสองค่าเป็นตัวเลือก ครูอาจให้แต่คะแนน เขียนแต่ความเห็น หรือทั้งคู่
 * ส่ง null มาคือลบค่าเดิมทิ้ง ต่างจากไม่ส่งมาเลยซึ่งคือไม่แตะค่าเดิม
 */
export class GradeStudentDto {
  @IsOptional()
  @IsInt({ message: 'score ต้องเป็นจำนวนเต็ม' })
  @Min(0, { message: 'score ต้องไม่ติดลบ' })
  @Max(1000, { message: 'score สูงเกินไป' })
  score?: number | null;

  @IsOptional()
  @IsString({ message: 'feedback ต้องเป็นข้อความ' })
  @MaxLength(5000, { message: 'feedback ยาวเกินไป' })
  feedback?: string | null;
}
