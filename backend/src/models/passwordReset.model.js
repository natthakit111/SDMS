const { pool } = require('../config/db');

// ⚠️ FIX: เดิมทำ DELETE ...WHERE user_id=? แล้วค่อย INSERT แยกกันคนละ query
// ไม่ atomic — ถ้า user กดขอลิงก์รีเซ็ตรัวๆ ภายในเวลาใกล้กันมาก (AUTH-12)
// 2 request อาจ DELETE ไม่เจออะไรให้ลบพร้อมกัน แล้ว INSERT ทับซ้อนกันจนมี
// token ของ user คนเดียวกันมากกว่า 1 แถวพร้อมกันจริง กลายเป็นว่าลิงก์เก่า
// ที่ควรถูกยกเลิกไปแล้วยังใช้งานได้อยู่ (ดู migration 0007 ที่เพิ่ม
// UNIQUE KEY บน user_id) เปลี่ยนเป็น atomic upsert เดียวจบ กัน race ได้จริง
// แม้ 2 request มาพร้อมกันเป๊ะ
const createResetToken = async (userId, token, expiresAt) => {
  await pool.query(
    `INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)`,
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