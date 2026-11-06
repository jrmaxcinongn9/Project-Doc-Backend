import { ForbiddenException } from '@nestjs/common';

/**
 * ครูแก้ได้เฉพาะของตัวเอง
 *
 * เดิมทุกเส้นที่แก้ห้อง งาน คะแนน หรือไฟล์ เช็คแค่ว่าเป็นครู
 * ครูคนไหนก็แก้หรือลบห้องและงานของครูคนอื่นได้ รวมถึงให้คะแนนแทน
 *
 * admin ทำได้ทุกอย่างเหมือนเดิม
 * ครูต้องเป็นเจ้าของห้อง (createdBy) หรือเป็นคนสร้างงานชิ้นนั้น
 */
export type AuthUser = {
  _id?: string;
  id?: string;
  userId?: string;
  sub?: string;
  role?: string;
};

// JwtStrategy คืน id ไว้ที่ _id แต่โค้ดเก่าบางจุดอ่านชื่ออื่น จึงรองรับไว้ทั้งหมด
export function userIdOf(user?: AuthUser | null): string | null {
  const id = user?._id ?? user?.id ?? user?.userId ?? user?.sub;
  return id ? String(id) : null;
}

export function isAdmin(user?: AuthUser | null): boolean {
  return user?.role === 'ADMIN';
}

function idOf(v: any): string | null {
  if (v === null || v === undefined) return null;
  return String(v?._id ?? v);
}

/** ห้องที่ populate หรือไม่ populate ก็ได้ */
export function ownsRoom(user: AuthUser | null | undefined, room: any): boolean {
  if (isAdmin(user)) return true;
  const uid = userIdOf(user);
  return !!uid && idOf(room?.createdBy) === uid;
}

/** งานพร้อมห้องของงาน ห้องจะ populate มาหรือส่งแยกก็ได้ */
export function ownsAssignment(user: AuthUser | null | undefined, doc: any, room?: any): boolean {
  if (isAdmin(user)) return true;
  const uid = userIdOf(user);
  if (!uid) return false;
  if (idOf(doc?.user_id) === uid) return true;
  return ownsRoom(user, room ?? doc?.classroom);
}

export function assertOwnsRoom(user: AuthUser | null | undefined, room: any) {
  if (!ownsRoom(user, room)) {
    throw new ForbiddenException('ห้องเรียนนี้ไม่ใช่ของคุณ');
  }
}

export function assertOwnsAssignment(user: AuthUser | null | undefined, doc: any, room?: any) {
  if (!ownsAssignment(user, doc, room)) {
    throw new ForbiddenException('งานชิ้นนี้ไม่ได้อยู่ในห้องเรียนของคุณ');
  }
}
