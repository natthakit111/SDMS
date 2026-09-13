/**
 * models/emailVerification.model.js
 * โครงสร้างเดียวกับ passwordReset.model.js — token ยืนยันอีเมล
 *
 * รับ conn ได้ (ต่างจาก passwordReset.model.js) เพราะต้องสร้าง token นี้อยู่
 * ในธุรกรรมเดียวกับการสร้าง/แก้ไข user (register, createTenant, updateTenant)
 * ถ้าธุรกรรมนั้น rollback ทีหลัง token ที่สร้างไว้ต้องหายไปด้วย ไม่ทิ้งค้าง
 */
const { pool } = require('../config/db');

const createToken = async (userId, token, expiresAt, conn = null) => {
  const runner = conn || pool;
  await runner.query(
    `INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)`,
    [userId, token, expiresAt]
  );
};

const findByToken = async (token) => {
  const [rows] = await pool.query(
    `SELECT ev.*, u.is_active
     FROM email_verifications ev
     JOIN users u ON u.user_id = ev.user_id
     WHERE ev.token = ? LIMIT 1`,
    [token]
  );
  return rows[0] || null;
};

const deleteToken = async (token) => {
  await pool.query('DELETE FROM email_verifications WHERE token = ?', [token]);
};

module.exports = {
  createToken,
  findByToken,
  deleteToken,
};
