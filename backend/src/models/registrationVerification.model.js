/**
 * models/registrationVerification.model.js
 *
 * ยืนยันอีเมล "ก่อน" สร้างบัญชีจริงตอน self-register ด้วยรหัส OTP 6 หลัก
 * (ต่างจาก emailVerification.model.js ที่ยืนยัน "หลัง" สร้างบัญชีแล้ว)
 *
 * Flow (ผูกกับอีเมลตรงๆ เพราะยังไม่มี user_id ตอนขอรหัส):
 *   1. upsertCode      — ขอรหัส OTP ใหม่ (resend ได้ ค่าเดิมถูกแทนที่)
 *   2. incrementAttempts / markVerified — เช็ครหัสตอน verify
 *   3. consumeTicket    — ใช้ ticket ครั้งเดียวตอน register จริง (atomic
 *      delete-then-check เหมือน oauthCode.model.js กัน race condition)
 */
const { pool } = require('../config/db');

const MAX_ATTEMPTS = 5;

const upsertCode = async (email, code, expiresAt) => {
  await pool.query(
    `INSERT INTO registration_verifications (email, code, code_expires_at, attempts, ticket, ticket_expires_at)
     VALUES (?, ?, ?, 0, NULL, NULL)
     ON DUPLICATE KEY UPDATE
       code = VALUES(code), code_expires_at = VALUES(code_expires_at),
       attempts = 0, ticket = NULL, ticket_expires_at = NULL`,
    [email, code, expiresAt]
  );
};

const findByEmail = async (email) => {
  const [rows] = await pool.query(
    'SELECT * FROM registration_verifications WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
};

const incrementAttempts = async (email) => {
  await pool.query(
    'UPDATE registration_verifications SET attempts = attempts + 1 WHERE email = ?',
    [email]
  );
};

const markVerified = async (email, ticket, ticketExpiresAt) => {
  await pool.query(
    `UPDATE registration_verifications
     SET code = NULL, code_expires_at = NULL, attempts = 0, ticket = ?, ticket_expires_at = ?
     WHERE email = ?`,
    [ticket, ticketExpiresAt, email]
  );
};

/**
 * ใช้ครั้งเดียว: หา ticket แล้วลบทิ้งทันทีไม่ว่าจะเจอหรือไม่ก็ตาม (เหมือน
 * oauthCode.model.js consumeCode) กัน replay ticket เดิมซ้ำ
 * @returns {string|null} email ถ้า ticket ถูกต้องและยังไม่หมดอายุ, null ถ้าไม่ผ่าน
 */
const consumeTicket = async (ticket) => {
  const [rows] = await pool.query(
    'SELECT * FROM registration_verifications WHERE ticket = ? LIMIT 1',
    [ticket]
  );
  if (rows.length === 0) return null;
  const record = rows[0];

  const [delResult] = await pool.query(
    'DELETE FROM registration_verifications WHERE ticket = ?',
    [ticket]
  );
  if (delResult.affectedRows === 0) return null;

  if (new Date(record.ticket_expires_at) < new Date()) return null;

  return record.email;
};

module.exports = {
  MAX_ATTEMPTS,
  upsertCode,
  findByEmail,
  incrementAttempts,
  markVerified,
  consumeTicket,
};
