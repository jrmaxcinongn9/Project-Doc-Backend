import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { Category } from '../../shared/enums/category.enum';

export class RegisterTeacherDTO {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  name: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @Matches(/@mail\.kmutt\.ac\.th$/i, { message: 'Email must end with @mail.kmutt.ac.th' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  // ความเชี่ยวชาญของครู ใช้จับคู่กับนักเรียน
  @IsEnum(Category, { message: 'category is not a valid value' })
  @IsNotEmpty({ message: 'category is required' })
  category: Category;
}