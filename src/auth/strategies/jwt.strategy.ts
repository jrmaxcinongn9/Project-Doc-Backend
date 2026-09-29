import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // เพิ่มก็ได้ ปลอดภัยกว่า
      secretOrKey: configService.get('JWT_SECRET') || 'yourSecretKeyHere',
    });
  }

  async validate(payload: any) {
    // payload = { email, sub, name, role, iat, exp }
    return {
      _id: payload.sub,       // ใช้ชื่อ _id ให้เข้ากับที่ controller เช็กไว้
      email: payload.email,
      name: payload.name,
      role: payload.role,     // 👈 สำคัญมาก ต้องส่ง role กลับไปด้วย
    };
  }
}
