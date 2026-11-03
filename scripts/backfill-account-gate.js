#!/usr/bin/env node
/**
 * Backfill for the account gate added in feat/account-gate.
 *
 * Accounts created before that change have neither isVerified nor status.
 * The login gate reads both, so without this script every existing account
 * is locked out the moment the new code is deployed.
 *
 * The script marks those accounts as already verified and already approved,
 * which is what they effectively were under the old rules.
 *
 * It only touches documents that are missing the fields. Running it twice
 * changes nothing the second time.
 *
 * Usage:
 *   MONGODB_URI='...' node scripts/backfill-account-gate.js          # dry run
 *   MONGODB_URI='...' node scripts/backfill-account-gate.js --apply  # write
 *
 * The connection string is read from the environment and is never printed.
 */

const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

// เงื่อนไขเดียวกันทั้งตอนนับและตอนเขียน ต้องไม่หลุดจากกัน
const MISSING_VERIFIED = {
  $or: [{ isVerified: { $exists: false } }, { isVerified: null }],
};

const MISSING_STATUS = {
  $or: [{ status: { $exists: false } }, { status: null }],
};

async function main() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI is not set. ตั้ง env นี้ก่อนรันสคริปต์');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const users = mongoose.connection.collection('users');

  const total = await users.countDocuments({});
  const needVerified = await users.countDocuments(MISSING_VERIFIED);
  const needStatus = await users.countDocuments(MISSING_STATUS);
  const needEither = await users.countDocuments({
    $or: [MISSING_VERIFIED, MISSING_STATUS],
  });

  console.log(`บัญชีทั้งหมด                 ${total}`);
  console.log(`ยังไม่มี isVerified          ${needVerified}`);
  console.log(`ยังไม่มี status              ${needStatus}`);
  console.log(`ต้องแก้ทั้งหมด               ${needEither}`);

  // แสดงรายชื่อที่จะถูกแตะ เพื่อให้ตรวจก่อนเขียนจริงได้
  if (needEither > 0) {
    const sample = await users
      .find({ $or: [MISSING_VERIFIED, MISSING_STATUS] })
      .project({ email: 1, role: 1 })
      .limit(50)
      .toArray();

    console.log('\nรายชื่อที่จะถูกแก้:');
    for (const u of sample) {
      console.log(`  ${u.role || 'USER'}\t${u.email}`);
    }
    if (needEither > sample.length) {
      console.log(`  ... และอีก ${needEither - sample.length} รายการ`);
    }
  }

  if (!APPLY) {
    console.log('\nนี่คือ dry run ยังไม่ได้เขียนอะไรลงฐานข้อมูล');
    console.log('ถ้าตรวจแล้วถูกต้อง สั่งซ้ำพร้อม --apply');
    await mongoose.disconnect();
    return;
  }

  if (needEither === 0) {
    console.log('\nไม่มีอะไรต้องแก้');
    await mongoose.disconnect();
    return;
  }

  const verified = await users.updateMany(MISSING_VERIFIED, {
    $set: { isVerified: true },
  });

  const approved = await users.updateMany(MISSING_STATUS, {
    $set: {
      status: 'APPROVED',
      approvedBy: 'backfill-account-gate',
      approvedAt: new Date(),
    },
  });

  console.log(`\nตั้ง isVerified = true      ${verified.modifiedCount} รายการ`);
  console.log(`ตั้ง status = APPROVED      ${approved.modifiedCount} รายการ`);

  const left = await users.countDocuments({
    $or: [MISSING_VERIFIED, MISSING_STATUS],
  });
  console.log(`เหลือที่ยังขาดฟิลด์          ${left}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('migration ล้มเหลว:', err.message);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
