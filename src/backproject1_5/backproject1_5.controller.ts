import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { Backproject15Service } from './backproject1_5.service';
import { CreateBackproject15Dto } from './dto/create-backproject1_5.dto';
import { UpdateBackproject15Dto } from './dto/update-backproject1_5.dto';

@Controller('backproject1-5')
export class Backproject15Controller {
  constructor(private readonly backproject15Service: Backproject15Service) {}

  @Post()
  create(@Body() createBackproject15Dto: CreateBackproject15Dto) {
    return this.backproject15Service.create(createBackproject15Dto);
  }

  @Get()
  findAll() {
    return this.backproject15Service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.backproject15Service.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBackproject15Dto: UpdateBackproject15Dto) {
    return this.backproject15Service.update(+id, updateBackproject15Dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.backproject15Service.remove(+id);
  }
}
