import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MinLength,Min,Max,Matches} from 'class-validator';
import { UserRole } from '../schema/user.schema';
import { Category } from '../../shared/enums/category.enum';
import { Type } from 'class-transformer';

export class RegisterDTO {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  @MinLength(4, { message: 'Name must be at least 4 long' })
  name: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @Matches(/@mail\.kmutt\.ac\.th$/i, { message: 'Email must end with @mail.kmutt.ac.th' })
  email: string;

  // @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(6)
  readonly password: string;

  @IsOptional()

  @IsEnum(UserRole)
  role?: UserRole;

  // สาขาของสถานประกอบการที่ไปฝึก ใช้จับคู่กับครู
  @IsEnum(Category, { message: 'category is not a valid value' })
  @IsNotEmpty({ message: 'category is required' })
  category: Category;

  @IsString()
  @IsNotEmpty()
  major: string;

  // ✅ แก้ตรงนี้
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$/, { message: 'student_id must be 11 digits' })
  student_id: string;

  
}
