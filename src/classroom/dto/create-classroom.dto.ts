import { IsNotEmpty, IsString, IsNumber, Min, Max  } from 'class-validator';
import { Type } from 'class-transformer';
export class CreateClassroomDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  major: string;

  @IsString()
  @IsNotEmpty()
  academicYear: string;

@Type(() => Number)
@IsNumber()
@Min(1)
@Max(4)
level: number;
}