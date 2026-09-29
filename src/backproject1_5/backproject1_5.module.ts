import { Module } from '@nestjs/common';
import { Backproject15Service } from './backproject1_5.service';
import { Backproject15Controller } from './backproject1_5.controller';

@Module({
  controllers: [Backproject15Controller],
  providers: [Backproject15Service],
})
export class Backproject15Module {}
