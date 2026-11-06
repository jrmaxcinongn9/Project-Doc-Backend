import { SupportModule } from './support/support.module';
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
        const configured =
          config.get<string>('MONGODB_URI') ||
          process.env.MONGODB_URI;

        // บน cloud (Render) ไม่มี MongoDB ที่ localhost
        // ถ้า env หายต้องพังทันทีพร้อมบอกสาเหตุ ไม่ใช่ค้างเงียบ ๆ
        const onCloud =
          process.env.RENDER !== undefined ||
          process.env.NODE_ENV === 'production';

        if (!configured && onCloud) {
          throw new Error(
            'MONGODB_URI is not set. ตั้งค่า env นี้ให้ชี้ไป MongoDB Atlas ก่อน deploy',
          );
        }

        const uri =
          configured || 'mongodb://localhost:27017/backproject1_5';

        // ต่อไม่ได้ให้ล้มเร็ว ไม่ใช่ค้างจนไม่มีใคร listen พอร์ต
        const common = {
          serverSelectionTimeoutMS: 10000,
          retryAttempts: 2,
          retryDelay: 2000,
        };

        if (uri.includes('localhost:27017')) {
          return {
            ...common,
            uri,
            user: config.get<string>('MONGO_USER') || 'root',
            pass: config.get<string>('MONGO_PASS') || 'example',
            dbName: config.get<string>('MONGO_DB_NAME') || 'backproject1_5',
          };
        }

        return { ...common, uri };
      },
    }),

    // เดิมมี MulterModule แบบ diskStorage ตรงนี้ เขียนไฟล์ลงดิสก์ด้วยชื่อเดิมของผู้ใช้
    // ไม่มีเส้นไหนใช้แล้ว ไฟล์ทั้งหมดไปที่ GridFS ผ่าน FileStorageService

    AuthModule,
    UserModule,
    AdminModule,
    TeacherModule,
    FileModule,
    DocModule,
    ClassroomModule,
    // แจ้งปัญหาจากหน้า support
    SupportModule,
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