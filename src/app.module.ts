import {
  Module,
  MiddlewareConsumer,
} from '@nestjs/common';

import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AdminModule } from './admin/admin.module';
import { TeacherModule } from './teacher/teacher.module';
import { FileModule } from './file/file.module';
import { DocModule } from './doc/doc.module';
import { ClassroomModule } from './classroom/classroom.module';

import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

import * as fs from 'fs';
import * as path from 'path';

// ✅ LOGGER
import { LoggerModule } from './logger/logger.module';
import { RequestLoggerMiddleware } from './logger/request.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ✅ LOGGER MODULE
    LoggerModule,

    // ✅ MONGOOSE (รองรับทั้ง MongoDB Atlas บน Cloud และ Localhost)
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri =
          config.get<string>('MONGODB_URI') ||
          process.env.MONGODB_URI ||
          'mongodb://localhost:27017/backproject1_5';

        if (uri.includes('localhost:27017')) {
          return {
            uri,
            user: config.get<string>('MONGO_USER') || 'root',
            pass: config.get<string>('MONGO_PASS') || 'example',
            dbName: config.get<string>('MONGO_DB_NAME') || 'backproject1_5',
          };
        }

        return { uri };
      },
    }),

    // ⭐ FILE UPLOAD (รองรับทุกระบบปฏิบัติการทั้ง Windows, Mac, Linux/Render)
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, callback) => {
          const studentId =
            req.body?.studentId || 'UNKNOWN';

          const baseDir = path.join(process.cwd(), 'uploads');
          const uploadDir = path.join(baseDir, studentId);

          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, {
              recursive: true,
            });
          }

          console.log(
            '📁 [Multer] Save to:',
            uploadDir,
          );

          callback(null, uploadDir);
        },

        filename: (req, file, callback) => {
          console.log(
            '📄 [Multer] Incoming:',
            file.originalname,
          );

          callback(null, file.originalname);
        },
      }),
    }),

    AuthModule,
    UserModule,
    AdminModule,
    TeacherModule,
    FileModule,
    DocModule,
    ClassroomModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {

  // ✅ APPLY LOGGER ทุก API
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes('*');
  }
}