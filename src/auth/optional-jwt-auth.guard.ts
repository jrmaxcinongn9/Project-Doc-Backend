import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * ปล่อยผ่านทั้งที่มีและไม่มี token
 * ต่างจาก JwtAuthGuard ตรงที่ไม่มี token แล้วไม่โยน 401 ออกไป
 * ใช้กับเส้นที่พฤติกรรมต่างกันตามว่าผู้เรียกเป็นใคร แต่ยังรับคนที่ยังไม่ login
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    return user ?? null;
  }
}
