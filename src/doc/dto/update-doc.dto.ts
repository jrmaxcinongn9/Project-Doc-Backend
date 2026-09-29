import { PartialType } from '@nestjs/mapped-types';
import { CreateDocDto } from './create-doc.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateDocDto {
  @IsOptional()
  @IsString()
  assignment_name?: string;
}