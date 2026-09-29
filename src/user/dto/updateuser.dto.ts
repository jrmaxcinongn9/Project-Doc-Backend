import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

import { Type } from 'class-transformer';
import { UserRole } from '../schema/user.schema';

export class UpdateUserDto {

  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MinLength(4, { message: 'Name must be at least 4 characters' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsEnum(UserRole, {
    message: 'role must be USER, ADMIN or TEACHER',
  })
  role?: UserRole;

  @IsOptional()
  @IsString()
  academicYear?: string;

  @IsOptional()
  @IsString()
  major?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, {
    message: 'student_id must be 11 digits',
  })
  student_id?: string;
}