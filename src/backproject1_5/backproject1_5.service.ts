import { Injectable } from '@nestjs/common';
import { CreateBackproject15Dto } from './dto/create-backproject1_5.dto';
import { UpdateBackproject15Dto } from './dto/update-backproject1_5.dto';

@Injectable()
export class Backproject15Service {
  create(createBackproject15Dto: CreateBackproject15Dto) {
    return 'This action adds a new backproject15';
  }

  findAll() {
    return `This action returns all backproject15`;
  }

  findOne(id: number) {
    return `This action returns a #${id} backproject15`;
  }

  update(id: number, updateBackproject15Dto: UpdateBackproject15Dto) {
    return `This action updates a #${id} backproject15`;
  }

  remove(id: number) {
    return `This action removes a #${id} backproject15`;
  }
}
