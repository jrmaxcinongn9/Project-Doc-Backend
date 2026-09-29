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

import { MailService } from '../mail/mail.service';

@Module({
  imports: [
    ConfigModule,     // เผื่อใช้ ConfigService ใน module นี้
    PassportModule,   // ใช้กับ LocalStrategy / JwtStrategy
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'yourSecretKeyHere',
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
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    RolesGuard,
    MailService, // ใช้ส่งเมล reset password
  ],
  exports: [
    AuthService,
    JwtModule,
    RolesGuard,
  ],
})
export class AuthModule {}
