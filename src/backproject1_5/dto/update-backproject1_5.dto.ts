import { PartialType } from '@nestjs/mapped-types';
import { CreateBackproject15Dto } from './create-backproject1_5.dto';

export class UpdateBackproject15Dto extends PartialType(CreateBackproject15Dto) {}
