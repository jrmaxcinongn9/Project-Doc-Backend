import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
 
export class RegisterAdminDTO{
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

}