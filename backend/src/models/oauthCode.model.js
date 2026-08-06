/**
 * models/oauthCode.model.js
 *
 * เก็บ short-lived, single-use exchange code สำหรับ OAuth callback
 * (Google / Telegram) แทนการฝัง JWT เต็มๆ ลงใน URL ตรงๆ
 *
 * Flow:
 *   1. Backend OAuth callback (Google/Telegram) verify ผู้ใช้สำเร็จ
 *   2. สร้าง random code (ไม่ใช่ JWT) อายุสั้นมาก (60 วินาที) ผูกกับ user_id
 *   3. Redirect ไป frontend ด้วย ?code=xxx (ไม่ใช่ ?token=xxx อีกต่อไป)
 *   4. Frontend ยิง POST /api/auth/oauth/exchange { code } ทันทีที่โหลดหน้า
 *   5. Backend เช็ค code ยังไม่หมดอายุ + ยังไม่เคยถูกใช้ → ออก JWT จริง
 *      คืนใน JSON response body (ไม่ใช่ URL) แล้วลบ code ทิ้ง (ใช้ได้ครั้งเดียว)
 *
 * เหตุผลที่ต้องทำแบบนี้: JWT (session token เต็มรูปแบบ อายุ 1 วัน) ที่ฝังใน
 * URL จะติดอยู่ใน browser history, server/proxy access log, และ Referer
 * header ได้หมด — ต่างจาก opaque code ที่ใช้ได้ครั้งเดียวและหมดอายุใน 60 วิ
 * ต่อให้หลุดไปอยู่ใน log ก็ใช้ประโยชน์แทบไม่ได้แล้วตอนมีคนมาเห็นภายหลัง
 */

const { pool } = require('../config/db');
const crypto = require('crypto');

const CODE_TTL_MS = 60 * 1000; // 60 วินาที — พอสำหรับ redirect + exchange ทันที

const createCode = async (userId) => {
  const code = crypto.randomBytes(32).toString('hex'); // 64 hex chars, สุ่มเดาไม่ได้
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await pool.query(
    `INSERT INTO oauth_exchange_codes (code, user_id, expires_at) VALUES (?, ?, ?)`,
    [code, userId, expiresAt]
  );
  return code;
};

/**
 * ใช้ครั้งเดียว: หา code แล้วลบทิ้งทันทีไม่ว่าจะเจอหรือไม่ก็ตาม
 * (ป้องกัน replay — ต่อให้ attacker ดัก request แรกไม่ทัน ก็เอา code
 * เดิมไปยิงซ้ำไม่ได้อีก เพราะถูกลบไปตั้งแต่ครั้งแรกที่ query แล้ว)
 *
 * @returns {number|null} user_id ถ้า code ถูกต้องและยังไม่หมดอายุ, null ถ้าไม่ผ่าน
 */
const consumeCode = async (code) => {
  const [rows] = await pool.query(
    `SELECT * FROM oauth_exchange_codes WHERE code = ? LIMIT 1`,
    [code]
  );
  if (rows.length === 0) return null;

  // ลบทันที ไม่รอเช็ค expiry ก่อน — กัน race condition ที่ request คู่ขนาน
  // อาจอ่าน record เดิมซ้ำก่อนถูกลบ
  await pool.query(`DELETE FROM oauth_exchange_codes WHERE code = ?`, [code]);

  const record = rows[0];
  if (new Date(record.expires_at) < new Date()) return null; // หมดอายุแล้ว

  return record.user_id;
};

module.exports = { createCode, consumeCode };