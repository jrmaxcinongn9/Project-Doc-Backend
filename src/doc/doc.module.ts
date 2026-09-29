import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocController } from './doc.controller';
import { DocService } from './doc.service';
import { DocEntity, DocSchema } from './schema/doc.schema';
import { Classroom, ClassroomSchema } from '../classroom/schemas/classroom.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocEntity.name, schema: DocSchema },
      { name: Classroom.name, schema: ClassroomSchema },
    ]),
  ],
  controllers: [DocController],
  providers: [DocService],
  exports: [DocService], // ✅ export ถึง module อื่น inject ได้
})
export class DocModule {}