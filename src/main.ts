import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app =
    await NestFactory.create<NestExpressApplication>(
      AppModule,
      {
        bufferLogs: false,
        logger: false,
      },
    );

  // ✅ ใช้ winston เป็น logger หลัก
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // static uploads (ข้ามแพลตฟอร์ม)
  const uploadRoot = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadRoot)) {
    fs.mkdirSync(uploadRoot, { recursive: true });
  }

  app.useStaticAssets(uploadRoot, {
    prefix: '/uploads/',
  });

  // validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(cookieParser());

  app.enableCors({
    origin: [
      'https://project-doc-fontend-1e7i.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
    ],
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization',
  });

  const port = process.env.PORT ?? 3000;

  await app.listen(port, '0.0.0.0');

  // ✅ correct logger usage
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(`🚀 Server running at http://0.0.0.0:${port}`);
}

bootstrap();