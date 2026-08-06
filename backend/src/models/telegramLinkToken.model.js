/**
 * models/telegramLinkToken.model.js
 * Raw SQL query functions for the `telegram_link_tokens` table.
 */

const { pool } = require('../config/db');

/**
 * สร้างหรือแทนที่ link token ของ user (มี ON DUPLICATE KEY เพราะ 1 user มี token ได้ record เดียว)
 */
const createOrReplace = async (userId, token, expiresAt) => {
  await pool.query(
    `INSERT INTO telegram_link_tokens (user_id, token, expires_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)`,
    [userId, token, expiresAt]
  );
};

/**
 * หา token ที่ยังไม่หมดอายุ
 */
const findValid = async (token) => {
  const [rows] = await pool.query(
    'SELECT * FROM telegram_link_tokens WHERE token = ? AND expires_at > NOW()',
    [token]
  );
  return rows[0] || null;
};

/**
 * ลบ token ทิ้งหลังใช้งานแล้ว
 */
const deleteToken = async (token) => {
  await pool.query('DELETE FROM telegram_link_tokens WHERE token = ?', [token]);
};

module.exports = { createOrReplace, findValid, deleteToken };