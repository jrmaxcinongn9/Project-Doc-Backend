import { jwtSecret } from './jwt-secret';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

import { LocalStrategy } from './strategies/local.strategies';  // 👈 เปลี่ยนให้ใช้ .strategy (เอกพจน์)
import { JwtStrategy } from './strategies/jwt.strategy';

import { RolesGuard } from './guards/roles.guard';

import { UserModule } from '../user/user.module';
import { AdminModule } from '../admin/admin.module';
import { TeacherModule } from '../teacher/teacher.module';

import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    ConfigModule,     // เผื่อใช้ ConfigService ใน module นี้
    PassportModule,   // ใช้กับ LocalStrategy / JwtStrategy
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: jwtSecret(configService),
        signOptions: {
          // ใช้ค่าจาก .env แทน process.env ตรง ๆ
          expiresIn:
            configService.get<string>('JWT_EXPIRATION_TIME') || '1h',
        },
      }),
    }),

    UserModule,
    AdminModule,
    TeacherModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    RolesGuard,
  ],
  exports: [
    AuthService,
    JwtModule,
    RolesGuard,
  ],
})
export class AuthModule {}
