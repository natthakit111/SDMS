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

// ⚠️ ใหม่: users.email มี UNIQUE constraint แยกจาก tenants.email — ใช้ใน
// tenantController.createTenant กันกรณีอีเมลชนกับบัญชี users คนอื่น (เช่น
// อีเมลแอดมินเอง) ที่ TenantModel.findConflictByPhoneOrEmail มองไม่เห็น
// เพราะเช็คแค่ตาราง tenants ทำให้ INSERT ไปชน unique constraint ดิบๆ ที่ DB
// แทน โชว์เป็น error กลางที่ไม่ระบุว่าฟิลด์ไหนซ้ำ
const findByEmail = async (email) => {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email]
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

// ⚠️ FIX: เดิมเป็น unconditional UPDATE เซ็ตทั้ง 4 คอลัมน์ทุกครั้งที่เรียก
// ไม่ว่าผู้เรียกจะส่ง key นั้นมาหรือไม่ (ใช้ `|| null` fallback) — จุดเรียก
// บางจุด (เช่น tenant.controller.js updateTenant ตอนแอดมินแก้แค่เบอร์/
// อีเมล) ส่งมาแค่ { phone, email } ไม่มี firstName/lastName เลย ทำให้
// first_name/last_name ของ users ถูกเซ็ตเป็น NULL ทุกครั้ง ทั้งที่ไม่ได้
// ตั้งใจแก้ชื่อเลย — เปลี่ยนเป็น partial update แบบเดียวกับ
// TenantModel.update: อัปเดตเฉพาะ key ที่ส่งมาจริง (!== undefined) เท่านั้น
const updateProfileFields = async (userId, { firstName, lastName, email, phone } = {}, conn = null) => {
  const fieldMap = { first_name: firstName, last_name: lastName, email, phone };
  const setClauses = [];
  const params = [];
  for (const [column, value] of Object.entries(fieldMap)) {
    if (value !== undefined) { setClauses.push(`${column} = ?`); params.push(value); }
  }
  if (!setClauses.length) return;
  params.push(userId);
  const runner = conn || pool;
  await runner.query(`UPDATE users SET ${setClauses.join(', ')} WHERE user_id = ?`, params);
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

const getAuthStatus = async (userId) => {
  const [rows] = await pool.query(
    'SELECT is_active, password_must_change FROM users WHERE user_id = ? LIMIT 1',
    [userId]
  );
  if (!rows[0]) return null; // user ถูกลบไปแล้วจริงๆ (ไม่ใช่แค่ deactivate)
  return {
    isActive: rows[0].is_active === 1,
    passwordMustChange: rows[0].password_must_change === 1,
  };
};

module.exports = {
  findByUsername,
  findByEmail,
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
  getAuthStatus,
};