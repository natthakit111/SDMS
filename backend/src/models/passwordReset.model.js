const { pool } = require('../config/db');

// ลบ token เก่าของ user คนนี้ทิ้งก่อนเสมอ — กันกรณีขอลิงก์รีเซ็ตหลายครั้ง
// แล้วลิงก์เก่าที่หลุด/ถูกดักไว้ (เช่น จากอีเมลที่ forward ต่อ) ยังใช้ได้อยู่
const createResetToken = async (userId, token, expiresAt) => {
  await pool.query('DELETE FROM password_resets WHERE user_id = ?', [userId]);
  await pool.query(
    'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt]
  );
};

const findByToken = async (token) => {
  const [rows] = await pool.query(
    `SELECT pr.*, u.is_active
     FROM password_resets pr
     JOIN users u ON u.user_id = pr.user_id
     WHERE pr.token = ? LIMIT 1`,
    [token]
  );
  return rows[0] || null;
};

const deleteToken = async (token) => {
  await pool.query('DELETE FROM password_resets WHERE token = ?', [token]);
};

module.exports = {
  createResetToken,
  findByToken,
  deleteToken,
};