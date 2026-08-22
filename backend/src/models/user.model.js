/**
 * models/user.model.js
 * Raw SQL query functions for the `users` table.
 * No ORM — uses mysql2 connection pool directly.
 */

const { pool } = require('../config/db');

const findByUsername = async (username) => {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE username = ? LIMIT 1',
    [username]
  );
  return rows[0] || null;
};

const findByIdentifier = async (identifier) => {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE username = ? OR email = ? OR phone = ? LIMIT 1',
    [identifier, identifier, identifier]
  );
  return rows[0] || null;
};

const findById = async (userId) => {
  const [rows] = await pool.query(
    `SELECT user_id, username, role, telegram_chat_id, is_active, created_at
     FROM users WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

const getProfileById = async (userId) => {
  const [rows] = await pool.query(
    `SELECT user_id, username, role, first_name, last_name, email, phone,
            telegram_chat_id, oauth_provider, password_must_change,
            CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN 1 ELSE 0 END AS has_password
     FROM users WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

const createUser = async (
  { username, password_hash, role = 'tenant', first_name = null, last_name = null, email = null, phone = null },
  conn = null
) => {
  const runner = conn || pool;
  const [result] = await runner.query(
    `INSERT INTO users (username, password_hash, role, first_name, last_name, email, phone)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [username, password_hash, role, first_name, last_name, email, phone]
  );
  return result.insertId;
};

const updateProfileFields = async (userId, { firstName, lastName, email, phone }) => {
  await pool.query(
    `UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE user_id = ?`,
    [firstName || null, lastName || null, email || null, phone || null, userId]
  );
};

const getPasswordHash = async (userId) => {
  const [rows] = await pool.query(
    'SELECT password_hash FROM users WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0]?.password_hash ?? null;
};

// ล้าง password_must_change ทุกครั้งที่ตั้ง/เปลี่ยนรหัสผ่านสำเร็จ (ผ่าน
// change-password, set-password, หรือ reset-password ก็ตาม) — เงื่อนไข
// "ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน" ถือว่าหมดไปทันทีที่มีการตั้งรหัสใหม่จริง
const setPasswordHash = async (userId, hash) => {
  await pool.query(
    'UPDATE users SET password_hash = ?, password_must_change = 0 WHERE user_id = ?',
    [hash, userId]
  );
};

const updateTelegramChatId = async (userId, telegramChatId) => {
  await pool.query(
    'UPDATE users SET telegram_chat_id = ? WHERE user_id = ?',
    [telegramChatId, userId]
  );
};

// ── ใหม่: ใช้ใน telegram.routes.js GET /status ──
const getTelegramChatId = async (userId) => {
  const [rows] = await pool.query(
    'SELECT telegram_chat_id FROM users WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0]?.telegram_chat_id || null;
};

// ── ใหม่: ใช้ใน telegram.routes.js DELETE /unlink ──
const clearTelegramChatId = async (userId) => {
  await pool.query('UPDATE users SET telegram_chat_id = NULL WHERE user_id = ?', [userId]);
};

const deactivateUser = async (userId) => {
  await pool.query('UPDATE users SET is_active = 0 WHERE user_id = ?', [userId]);
};

const findAll = async () => {
  const [rows] = await pool.query(
    `SELECT user_id, username, role, telegram_chat_id, is_active, created_at
     FROM users ORDER BY created_at DESC`
  );
  return rows;
};

// ใช้เติม dropdown "มอบหมายให้" ในหน้าแจ้งซ่อม — เฉพาะ admin ที่ยัง active
const findAdmins = async () => {
  const [rows] = await pool.query(
    `SELECT user_id, username, first_name, last_name
     FROM users WHERE role = 'admin' AND is_active = 1
     ORDER BY first_name, last_name`
  );
  return rows;
};

//  ใช้เช็ค is_active ทุก request ที่ authenticate (ดู
// auth.middleware.js) — เลือก SELECT แค่ 2 คอลัมน์ที่จำเป็นเพื่อให้ query
// เบาที่สุด ไม่ใช้ findById() ที่ select field เยอะกว่าที่ต้องการ
const isUserActive = async (userId) => {
  const [rows] = await pool.query(
    'SELECT is_active FROM users WHERE user_id = ? LIMIT 1',
    [userId]
  );
  if (!rows[0]) return false; // user ถูกลบไปแล้วจริงๆ (ไม่ใช่แค่ deactivate)
  return rows[0].is_active === 1;
};

module.exports = {
  findByUsername,
  findByIdentifier,
  findById,
  getProfileById,
  createUser,
  updateProfileFields,
  getPasswordHash,
  setPasswordHash,
  updateTelegramChatId,
  getTelegramChatId,
  clearTelegramChatId,
  deactivateUser,
  findAll,
  findAdmins,
  isUserActive,
};