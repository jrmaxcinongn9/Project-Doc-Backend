import { ConfigService } from '@nestjs/config';

/**
 * ค่าลับที่ใช้เซ็น JWT
 *
 * เดิมถ้าไม่ได้ตั้ง JWT_SECRET จะใช้ 'yourSecretKeyHere' ซึ่งอยู่ในโค้ดสาธารณะ
 * ใครอ่าน repo ก็ปลอม token เป็น admin ได้ทันที ถ้า env หายบน production
 *
 * บน cloud (Render หรือ NODE_ENV=production) ต้องพังทันทีพร้อมบอกสาเหตุ
 * ในเครื่องยังใช้ค่าปริยายได้ เพื่อให้รันเทสและพัฒนาได้สะดวก
 */
export function jwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (secret) return secret;

  const onCloud =
    process.env.RENDER !== undefined || process.env.NODE_ENV === 'production';

  if (onCloud) {
    throw new Error('JWT_SECRET is not set. ตั้งค่า env นี้ก่อน deploy');
  }

  return 'local-dev-only-secret';
}
