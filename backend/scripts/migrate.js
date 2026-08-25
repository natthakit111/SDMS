/**
 * scripts/migrate.js
 *
 * ระบบ migration แบบเรียบง่าย ตรงกับสไตล์ raw-SQL ของโปรเจกต์นี้ (ไม่มี ORM)
 * — ไม่ได้แทนที่ backend/database/schema.sql (ยังใช้ไฟล์นั้นสำหรับติดตั้งฐานข้อมูล
 * ใหม่ตั้งแต่ต้นเหมือนเดิม ตาม README) แต่แก้ปัญหา "ไม่มีทางบอกได้ว่า
 * ฐานข้อมูลที่ติดตั้งไปแล้วตามทันโครงสร้างล่าสุดหรือยัง" — ทุกครั้งที่
 * backend/database/schema.sql เปลี่ยน (เพิ่มคอลัมน์/index/ตาราง) ให้เพิ่มไฟล์
 * migration ใหม่ในโฟลเดอร์ backend/database/migrations/ คู่กันไปด้วยเสมอ
 *
 * วิธีใช้:
 *   node scripts/migrate.js              รัน migration ที่ค้างอยู่ทั้งหมด
 *   node scripts/migrate.js --status     ดูว่า migration ไหนรันไปแล้ว/ค้างอยู่
 *   node scripts/migrate.js --baseline   บันทึกว่า migration ทั้งหมดที่มีอยู่
 *                                        ตอนนี้ "รันไปแล้ว" โดยไม่รัน SQL จริง
 *                                        — ใช้ครั้งเดียวตอน setup ฐานข้อมูลที่
 *                                        เพิ่งสร้างจาก schema.sql (มีโครงสร้าง
 *                                        ล่าสุดอยู่แล้ว ไม่ต้องรัน migration ซ้ำ)
 *
 * เพิ่ม npm script ไว้ใน package.json แล้ว: npm run migrate / migrate:status / migrate:baseline
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'migrations');

const ensureMigrationsTable = async (conn) => {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        varchar(255) NOT NULL,
      applied_at  datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const listMigrationFiles = () => {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // ชื่อไฟล์ขึ้นต้นด้วยเลข 4 หลัก (0001_, 0002_, ...) เรียงตามลำดับรันได้พอดี
};

const getAppliedNames = async (conn) => {
  const [rows] = await conn.query('SELECT name FROM schema_migrations');
  return new Set(rows.map((r) => r.name));
};

const runPending = async () => {
  const conn = await pool.getConnection();
  try {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedNames(conn);
    const files = listMigrationFiles();
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('✅  ไม่มี migration ค้างอยู่ — ฐานข้อมูลตามทันล่าสุดแล้ว');
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`▶  รัน ${file} ...`);

      // ⚠️ ไม่ครอบ beginTransaction/commit รอบ DDL — MySQL ทำ implicit
      // commit ทุกครั้งที่เจอ ALTER/CREATE/DROP อยู่แล้ว (rollback คำสั่ง
      // พวกนี้ไม่ได้จริงไม่ว่าจะครอบ transaction หรือไม่) ตอนทดสอบสดพบว่า
      // ครอบ transaction รอบ DDL หลายคำสั่งทำให้ statement ถัดจากตัวแรก
      // ไม่ถูก apply จริง (ทั้งที่ query() ไม่ throw error เลย) จึงตัดออก
      // รันทีละ statement ตรงๆ แทน ปลอดภัยกว่าและตรงกับพฤติกรรมจริงของ DDL
      //
      // ⚠️ ต้องตัดบรรทัดคอมเมนต์ (--) ออกก่อน split ด้วย ; เสมอ — เดิม
      // เช็คแค่ว่า statement ทั้งก้อน (หลัง trim) ขึ้นต้นด้วย -- หรือไม่
      // ซึ่งพังทันทีถ้าไฟล์มีคอมเมนต์นำหน้า statement จริง (บรรทัด
      // คอมเมนต์ไม่มี ; คั่น เลยรวมเป็นก้อนเดียวกับ SQL จริงที่ตามมา
      // ทำให้ทั้งก้อนถูกกรองทิ้งเงียบๆ ไม่มี statement ไหนถูกรันเลย
      // แต่ยัง insert ลง schema_migrations ว่า "สำเร็จ" ทั้งที่ไม่ได้ทำ
      // อะไรจริง — เจอบั๊กนี้ตอนทดสอบสดกับ scratch DB ก่อน commit)
      const sqlNoComments = sql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n');
      const statements = sqlNoComments
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      try {
        for (const stmt of statements) {
          await conn.query(stmt);
        }
        await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
        console.log(`✅  ${file} สำเร็จ`);
      } catch (err) {
        throw new Error(
          `Migration ${file} ล้มเหลว: ${err.message} — ถ้ามี statement ก่อนหน้าใน` +
          ` migration นี้ที่รันผ่านไปแล้ว มันจะยัง apply ค้างอยู่ (DDL rollback ไม่ได้)` +
          ` ตรวจ DB ด้วยตัวเองก่อนรันซ้ำ`,
        );
      }
    }
  } finally {
    conn.release();
    await pool.end();
  }
};

const showStatus = async () => {
  const conn = await pool.getConnection();
  try {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedNames(conn);
    const files = listMigrationFiles();
    if (files.length === 0) {
      console.log('ยังไม่มีไฟล์ migration ในโฟลเดอร์ backend/database/migrations/');
      return;
    }
    for (const file of files) {
      console.log(`${applied.has(file) ? '✅ applied  ' : '⬜ pending  '} ${file}`);
    }
  } finally {
    conn.release();
    await pool.end();
  }
};

const baseline = async () => {
  const conn = await pool.getConnection();
  try {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedNames(conn);
    const files = listMigrationFiles();
    const toMark = files.filter((f) => !applied.has(f));
    for (const file of toMark) {
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      console.log(`📌  บันทึกว่า ${file} รันไปแล้ว (ไม่ได้รัน SQL จริง)`);
    }
    if (toMark.length === 0) console.log('ไม่มี migration ใหม่ที่ต้อง baseline');
  } finally {
    conn.release();
    await pool.end();
  }
};

(async () => {
  const arg = process.argv[2];
  try {
    if (arg === '--status') await showStatus();
    else if (arg === '--baseline') await baseline();
    else await runPending();
  } catch (err) {
    console.error('❌ ', err.message);
    process.exit(1);
  }
})();
