import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MinLength,Min,Max,Matches} from 'class-validator';
import { UserRole } from '../schema/user.schema';
import { Type } from 'class-transformer';

export class RegisterDTO {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  @MinLength(4, { message: 'Name must be at least 4 long' })
  name: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  // @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(6)
  readonly password: string;

  @IsOptional()

  @IsEnum(UserRole)
  role?: UserRole;

@Type(() => Number)
@IsNumber()
@IsNotEmpty()
@Min(1000, { message: 'academicYear must be 4 digits' })
@Max(9999, { message: 'academicYear must be 4 digits' })
academicYear: number;

  @IsString()
  @IsNotEmpty()
  major: string;

  // ✅ แก้ตรงนี้
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, { message: 'student_id must be 11 digits' })
  student_id: string;

  
}
