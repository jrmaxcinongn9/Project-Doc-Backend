#!/usr/bin/env node
/**
 * ทำให้ index ของ student_id เป็นแบบ sparse
 *
 * schema ประกาศ student_id ไว้ว่า unique และ sparse แต่ MongoDB ไม่แก้ index
 * ที่สร้างไปแล้วให้เอง ฐานข้อมูลจริงจึงยังมี index แบบ unique ธรรมดาค้างอยู่
 *
 * ผลคือเอกสารที่ไม่มี student_id ถูกมองว่ามีค่าเป็น null เท่ากันหมด
 * บัญชีแรกที่ไม่มีรหัสนักศึกษาจึงจองที่ไว้ และบัญชีถัดไปทุกใบชนกันทันที
 * แปลว่า admin สร้างบัญชีครูไม่ได้เลยสักใบ เพราะครูไม่มีรหัสนักศึกษา
 * error ที่เห็นคือ Duplicate data detected ซึ่งอ่านแล้วไม่มีทางเดาสาเหตุถูก
 *
 * สคริปต์นี้ลบ index เดิมแล้วสร้างใหม่เป็น unique + sparse
 * เอกสารที่ไม่มีฟิลด์นี้จะไม่ถูกนับใน index อีกต่อไป ส่วนรหัสที่มีค่ายังห้ามซ้ำเหมือนเดิม
 *
 * ใช้:
 *   node scripts/fix-student-id-index.js            ดูอย่างเดียว ไม่เขียน
 *   node scripts/fix-student-id-index.js --apply    เขียนจริง
 *
 * อ่าน MONGODB_URI จาก environment และไม่พิมพ์ค่านั้นออกมา
 */
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const INDEX_NAME = 'student_id_1';

async function main() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('ไม่พบ MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const users = mongoose.connection.db.collection('users');
  const indexes = await users.indexes();
  const current = indexes.find((i) => i.name === INDEX_NAME);

  if (!current) {
    console.log(`ไม่มี index ชื่อ ${INDEX_NAME} ไม่ต้องทำอะไร`);
    await mongoose.disconnect();
    return;
  }

  console.log('index ปัจจุบัน:', JSON.stringify(current));

  if (current.sparse) {
    console.log('เป็น sparse อยู่แล้ว ไม่ต้องทำอะไร');
    await mongoose.disconnect();
    return;
  }

  const withoutStudentId = await users.countDocuments({
    student_id: { $in: [null, ''] },
  });
  const missingField = await users.countDocuments({
    student_id: { $exists: false },
  });

  console.log(`บัญชีที่ไม่มีรหัสนักศึกษา: ${withoutStudentId + missingField} ใบ`);
  console.log('บัญชีพวกนี้คือที่ชนกันอยู่ ส่วนใหญ่เป็น admin และครู');

  if (!APPLY) {
    console.log('');
    console.log('โหมดดูอย่างเดียว ยังไม่ได้แก้อะไร');
    console.log('สั่งแก้จริงด้วย --apply');
    await mongoose.disconnect();
    return;
  }

  await users.dropIndex(INDEX_NAME);
  console.log(`ลบ ${INDEX_NAME} แล้ว`);

  await users.createIndex(
    { student_id: 1 },
    { unique: true, sparse: true, name: INDEX_NAME },
  );
  console.log(`สร้าง ${INDEX_NAME} ใหม่เป็น unique + sparse แล้ว`);

  const after = (await users.indexes()).find((i) => i.name === INDEX_NAME);
  console.log('index หลังแก้:', JSON.stringify(after));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('ล้มเหลว:', err.message);
  process.exit(1);
});
