import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import * as fs from 'fs';
import 'winston-daily-rotate-file';

// =======================
// ✅ สร้าง folder logs อัตโนมัติ
// =======================
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// =======================
// ✅ format อ่านง่าย (Human Friendly)
// =======================
const readableFormat = winston.format.printf((info) => {
  const { timestamp, level, message, context, stack, ...meta } = info;

  let log = `[${timestamp}] ${level.toUpperCase()}`;

  if (context) {
    log += ` [${context}]`;
  }

  log += ` → ${message}`;

  // show meta แบบอ่านง่าย
  if (Object.keys(meta).length) {
    log += `\nMETA: ${JSON.stringify(meta, null, 2)}`;
  }

  // show error stack ถ้ามี
  if (stack) {
    log += `\nSTACK:\n${stack}`;
  }

  return log;
});

// =======================
// ✅ filter ตัด Nest internal logs
// =======================
const ignoreNestLogs = winston.format((info) => {
  const ignoreContexts = [
    'RouterExplorer',
    'RoutesResolver',
    'NestApplication',
    'InstanceLoader',
  ];

  const context = info.context as string | undefined;

  if (context && ignoreContexts.includes(context)) {
    return false;
  }

  return info;
});

// =======================
// ✅ shared format
// =======================
const baseFormat = winston.format.combine(
  ignoreNestLogs(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }), // ⭐ สำคัญมาก (error stack)
  readableFormat,
);

@Module({
  imports: [
    WinstonModule.forRoot({
      level: 'info',

      transports: [
        // ======================
        // ✅ APP LOG
        // ======================
        new winston.transports.DailyRotateFile({
          filename: 'logs/app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '30d',
          zippedArchive: true,
          format: baseFormat,
        }),

        // ======================
        // ✅ ERROR LOG (แยก error)
        // ======================
        new winston.transports.DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxFiles: '60d',
          zippedArchive: true,
          format: baseFormat,
        }),

        // ======================
        // ✅ Console (dev mode)
        // ======================
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            baseFormat,
          ),
        }),
      ],
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule { }