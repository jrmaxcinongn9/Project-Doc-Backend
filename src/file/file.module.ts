// src/file/file.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { FileEntity, FileSchema } from './schema/file.schema';
import { DocModule } from '../doc/doc.module';   // ✅ import DocModule

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FileEntity.name, schema: FileSchema },
    ]),
    DocModule,                                   // ✅ เพิ่มตรงนี้
  ],
  controllers: [FileController],
  providers: [FileService],
})
export class FileModule {}
