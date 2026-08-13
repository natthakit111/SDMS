/**
 * models/settings.model.js
 * Raw SQL query functions for `dorm_settings` + `settings_audit_log`.
 */
const { pool } = require('../config/db');

const getAll = async () => {
  const [rows] = await pool.query('SELECT setting_key, setting_value FROM dorm_settings');
  const settings = {};
  rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
  return settings;
};

const getByKeys = async (keys) => {
  if (!keys.length) return {};
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM dorm_settings WHERE setting_key IN (?)`,
    [keys]
  );
  const values = {};
  rows.forEach(r => { values[r.setting_key] = r.setting_value; });
  return values;
};

/**
 * อัปเดต setting ทีละคู่ key/value พร้อมบันทึก audit log ในทีเดียว —
 * รวมไว้ในฟังก์ชันเดียวโดยตั้งใจ เพื่อไม่ให้ที่ไหนแก้ dorm_settings
 * โดยลืมเขียน audit log (field พวกนี้กระทบเงินจริง ต้องสืบย้อนได้เสมอ)
 */
const upsertWithAudit = async (userId, key, newValue, oldValue) => {
  await pool.query(
    `INSERT INTO dorm_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, String(newValue)]
  );

  await pool.query(
    `INSERT INTO settings_audit_log (user_id, setting_key, old_value, new_value)
     VALUES (?, ?, ?, ?)`,
    [userId, key, oldValue ?? null, String(newValue)]
  );
};

const getAuditLog = async ({ settingKey = null, limit = 50 } = {}) => {
  let sql = `
    SELECT sal.log_id, sal.setting_key, sal.old_value, sal.new_value,
           sal.changed_at, u.username AS changed_by
    FROM settings_audit_log sal
    JOIN users u ON sal.user_id = u.user_id
  `;
  const params = [];
  if (settingKey) {
    sql += ' WHERE sal.setting_key = ?';
    params.push(settingKey);
  }
  sql += ' ORDER BY sal.changed_at DESC LIMIT ?';
  params.push(parseInt(limit) || 50);

  const [rows] = await pool.query(sql, params);
  return rows;
};

module.exports = { getAll, getByKeys, upsertWithAudit, getAuditLog };