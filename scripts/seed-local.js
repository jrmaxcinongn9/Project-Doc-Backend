// สร้างข้อมูลทดสอบระบบคะแนนในฐานข้อมูลในเครื่อง
//
//   node scripts/seed-local.js
//
// ใช้กับ MongoDB ในเครื่องเท่านั้น สคริปต์ไม่ยอมรันถ้า MONGODB_URI ไม่ใช่ localhost
// รันซ้ำได้ ลบข้อมูลชุดเดิมของสคริปต์นี้ก่อนแล้วสร้างใหม่
//
// สถานการณ์ที่จำลอง
//   งาน A  ไม่มีคะแนนเต็ม (งานเก่า)      ช่องคะแนนต้องถูกปิด จนกว่าครูจะตั้งคะแนนเต็ม
//   งาน B  มีคะแนนเต็ม 10               ให้คะแนนได้ตามปกติ
//   นักเรียน C เข้าห้องหลังสร้างงานทั้งสอง  ต้องขึ้นในหน้าให้คะแนนและให้คะแนนได้

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// รหัสผ่านทดสอบของทุกบัญชีในสคริปต์นี้ ใช้ในเครื่องเท่านั้น
const PASSWORD = 'LocalTest#2026';

const uri = process.env.MONGODB_URI || 'mongodb://root:example@localhost:27017/backproject1_5?authSource=admin';

if (!/localhost|127\.0\.0\.1/.test(uri)) {
  console.error('MONGODB_URI ไม่ได้ชี้ไปที่เครื่องนี้ ไม่รันเพื่อกันข้อมูลจริงเสียหาย');
  process.exit(1);
}

const TAG = 'seed-local';

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const classrooms = db.collection('classrooms');
  const docs = db.collection('docs');

  // ล้างชุดเดิม
  const oldRooms = await classrooms.find({ seed: TAG }).toArray();
  await docs.deleteMany({ classroom: { $in: oldRooms.map((r) => r._id) } });
  await classrooms.deleteMany({ seed: TAG });
  await users.deleteMany({ seed: TAG });

  const hash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();

  const base = {
    password: hash,
    isVerified: true,
    status: 'APPROVED',
    seed: TAG,
    createdAt: now,
    updatedAt: now,
  };

  const admin = { ...base, name: 'Local Admin', email: 'admin.local@mail.kmutt.ac.th', role: 'ADMIN' };
  const teacher = {
    ...base,
    name: 'Local Teacher',
    email: 'teacher.local@mail.kmutt.ac.th',
    role: 'TEACHER',
    category: 'SOFTWARE',
  };
  const student = (n, sid) => ({
    ...base,
    name: `Student ${n}`,
    email: `student${n.toLowerCase()}.local@mail.kmutt.ac.th`,
    role: 'USER',
    category: 'SOFTWARE',
    major: 'CS',
    student_id: sid,
  });
  const stuA = student('A', '66990000001');
  const stuB = student('B', '66990000002');
  const stuC = student('C', '66990000003');

  const r = await users.insertMany([admin, teacher, stuA, stuB, stuC]);
  const [, teacherId, aId, bId, cId] = Object.values(r.insertedIds);

  const room = await classrooms.insertOne({
    name: 'ห้องทดสอบในเครื่อง',
    major: 'CS',
    academicYear: '2569',
    level: 1,
    // C อยู่ในห้อง แต่ไม่อยู่ในรายชื่อของงาน เหมือนถูกเพิ่มเข้ามาทีหลัง
    students: [aId, bId, cId],
    createdBy: teacherId,
    isActive: true,
    assignments: [],
    seed: TAG,
    createdAt: now,
    updatedAt: now,
  });

  const snapshot = [
    { student_id: aId, name: stuA.name, status: 'PENDING' },
    { student_id: bId, name: stuB.name, status: 'PENDING' },
  ];

  const assignment = (name, max) => ({
    assignment_name: name,
    classroom: room.insertedId,
    user_id: String(teacherId),
    user_name: teacher.name,
    publish_date: now,
    due_date: new Date(now.getTime() + 7 * 864e5),
    max_score: max,
    students: snapshot.map((s) => ({ ...s })),
    createdAt: now,
    updatedAt: now,
  });

  const d = await docs.insertMany([
    assignment('งาน A ไม่มีคะแนนเต็ม', null),
    assignment('งาน B คะแนนเต็ม 10', 10),
  ]);

  await classrooms.updateOne(
    { _id: room.insertedId },
    { $set: { assignments: Object.values(d.insertedIds) } },
  );

  console.log('สร้างข้อมูลทดสอบเรียบร้อย');
  console.log('  ครู      teacher.local@mail.kmutt.ac.th');
  console.log('  admin    admin.local@mail.kmutt.ac.th');
  console.log('  นักเรียน studenta/b/c.local@mail.kmutt.ac.th');
  console.log('  รหัสผ่านอยู่ในค่า PASSWORD ของไฟล์นี้');
  for (const [i, id] of Object.entries(d.insertedIds)) {
    console.log(`  งาน ${i === '0' ? 'A' : 'B'}  http://localhost:8000/teacher/assignment-view/${id}`);
  }

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
