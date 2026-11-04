#!/usr/bin/env node
/**
 * ย้ายบัญชี admin จาก collection `admins` ไปอยู่ใน `users` พร้อม role ADMIN
 *
 * admin เคยถูกเก็บแยก ซึ่งไม่มีเส้น login ไหนอ่านเลย บัญชีที่สร้างไว้จึงเข้าระบบ
 * ไม่ได้ สคริปต์นี้ย้ายของเก่ามาให้ใช้งานได้ โดยไม่แตะรหัสผ่าน
 * รหัสที่เก็บไว้ถูก hash ด้วย bcrypt อยู่แล้ว และ schema ของ users ใช้แบบเดียวกัน
 *
 * ใช้:
 *   node scripts/move-admins-into-users.js            ดูอย่างเดียว ไม่เขียน
 *   node scripts/move-admins-into-users.js --apply    เขียนจริง
 *
 * อ่าน MONGODB_URI จาก environment และไม่พิมพ์ค่านั้นออกมา
 */
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

async function main() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('ไม่พบ MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const admins = await db.collection('admins').find({}).toArray();

  console.log(`พบใน admins ${admins.length} รายการ`);

  let moved = 0;
  let skipped = 0;

  for (const admin of admins) {
    const existing = await db
      .collection('users')
      .findOne({ email: admin.email });

    if (existing) {
      // มีอยู่แล้วใน users ไม่เขียนทับ เพราะอาจเป็นบัญชีคนละใบที่ใช้อีเมลเดียวกัน
      console.log(`ข้าม ${admin.email} มีอยู่ใน users แล้ว role=${existing.role}`);
      skipped += 1;
      continue;
    }

    const doc = {
      name: admin.name,
      email: admin.email,
      password: admin.password,
      role: 'ADMIN',
      isVerified: true,
      status: 'APPROVED',
      createdAt: admin.createdAt ?? new Date(),
      updatedAt: new Date(),
      __v: 0,
    };

    if (APPLY) {
      await db.collection('users').insertOne(doc);
    }

    console.log(`${APPLY ? 'ย้าย' : 'จะย้าย'} ${admin.email}`);
    moved += 1;
  }

  console.log(`\nสรุป ย้าย ${moved} ข้าม ${skipped}`);

  if (!APPLY) {
    console.log('นี่คือการดูอย่างเดียว ใส่ --apply เพื่อเขียนจริง');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
