/**
 * models/tenant.model.js
 * Raw SQL query functions for the `tenants` table.
 */

const { pool } = require('../config/db');

const findAll = async ({ search = null, isActive = true } = {}) => {
  let sql = `
    SELECT
      t.*,
      u.username, u.telegram_chat_id, u.is_active,
      r.room_number, r.room_id,
      c.contract_id, c.status AS contract_status
    FROM tenants t
    JOIN users u ON t.user_id = u.user_id
    LEFT JOIN contracts c ON c.tenant_id = t.tenant_id AND c.status = 'active'
    LEFT JOIN rooms r ON r.room_id = c.room_id`;
  const params = [];
  // กรองตาม is_active: true = ผู้เช่าปัจจุบัน, false = ผู้เช่าเก่า (ถูกลบ)
  sql += ` WHERE u.is_active = ?`;
  params.push(isActive ? 1 : 0);
  if (search) {
    sql += ` AND (t.first_name LIKE ? OR t.last_name LIKE ? OR t.phone LIKE ? OR t.id_card_number LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  sql += ' ORDER BY t.created_at DESC';
  const [rows] = await pool.query(sql, params);
  return rows;
};
const findById = async (tenantId) => {
  const [rows] = await pool.query(
    `SELECT t.*, u.username, u.telegram_chat_id, u.is_active
     FROM tenants t JOIN users u ON t.user_id = u.user_id
     WHERE t.tenant_id = ? LIMIT 1`,
    [tenantId]
  );
  return rows[0] || null;
};

const findByUserId = async (userId) => {
  const [rows] = await pool.query('SELECT * FROM tenants WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] || null;
};

const findByIdCard = async (idCardNumber) => {
  const [rows] = await pool.query(
    'SELECT * FROM tenants WHERE id_card_number = ? LIMIT 1',
    [idCardNumber]
  );
  return rows[0] || null;
};

const update = async (tenantId, fields) => {
  const allowed = [
    'first_name', 'last_name', 'phone', 'email',
    'emergency_contact_name', 'emergency_contact_phone', 'profile_image',
  ];
  const setClauses = [];
  const params = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) { setClauses.push(`${key} = ?`); params.push(fields[key]); }
  }
  if (!setClauses.length) return 0;
  params.push(tenantId);
  const [result] = await pool.query(`UPDATE tenants SET ${setClauses.join(', ')} WHERE tenant_id = ?`, params);
  return result.affectedRows;
};

module.exports = { findAll, findById, findByUserId, findByIdCard, update };