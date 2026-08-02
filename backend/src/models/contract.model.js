/**
 * models/contract.model.js
 * Raw SQL query functions for the `contracts` table.
 */

const { pool } = require('../config/db');

const findAll = async ({ status = null, tenant_id = null, room_id = null } = {}) => {
  let sql = `
    SELECT
      c.*,
      CONCAT(t.first_name, ' ', t.last_name) AS tenant_name,
      t.phone AS tenant_phone,
      r.room_number, r.floor,
      d.status         AS deposit_status,
      d.refund_amount  AS deposit_refund_amount,
      d.deduction      AS deposit_deduction,
      d.deduction_note AS deposit_deduction_note,
      d.refund_date    AS deposit_refund_date
    FROM contracts c
    JOIN tenants t ON c.tenant_id = t.tenant_id
    JOIN rooms   r ON c.room_id   = r.room_id
    LEFT JOIN deposits d ON d.contract_id = c.contract_id`;
  const conditions = [];
  const params = [];
  if (status)    { conditions.push('c.status = ?');    params.push(status); }
  if (tenant_id) { conditions.push('c.tenant_id = ?'); params.push(tenant_id); }
  if (room_id)   { conditions.push('c.room_id = ?');   params.push(room_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY c.created_at DESC';
  const [rows] = await pool.query(sql, params);
  return rows;
};

const findById = async (contractId) => {
  const [rows] = await pool.query(
    `SELECT
       c.*,
       CONCAT(t.first_name, ' ', t.last_name) AS tenant_name,
       t.phone AS tenant_phone, t.id_card_number,
       r.room_number, r.floor, r.base_rent
     FROM contracts c
     JOIN tenants t ON c.tenant_id = t.tenant_id
     JOIN rooms   r ON c.room_id   = r.room_id
     WHERE c.contract_id = ? LIMIT 1`,
    [contractId]
  );
  return rows[0] || null;
};

const findActiveByRoom = async (roomId) => {
  const [rows] = await pool.query(
    "SELECT * FROM contracts WHERE room_id = ? AND status = 'active' LIMIT 1",
    [roomId]
  );
  return rows[0] || null;
};

const findActiveByTenant = async (tenantId) => {
  const [rows] = await pool.query(
    `SELECT c.*, r.room_number, r.floor
     FROM contracts c JOIN rooms r ON c.room_id = r.room_id
     WHERE c.tenant_id = ? AND c.status = 'active' LIMIT 1`,
    [tenantId]
  );
  return rows[0] || null;
};

// Create contract — does NOT touch room status (controller handles that separately)
// executor: ส่ง conn เข้ามาถ้าอยู่ใน transaction, ไม่งั้นใช้ pool ตามปกติ
const create = async ({ tenant_id, room_id, start_date, end_date, rent_amount, deposit_amount, note }, executor = pool) => {
  const [result] = await executor.query(
    `INSERT INTO contracts
       (tenant_id, room_id, start_date, end_date, rent_amount, deposit_amount, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenant_id, room_id, start_date, end_date, rent_amount, deposit_amount || 0, note || null]
  );
  return result.insertId;
};

const update = async (contractId, fields) => {
  const allowed = ['end_date', 'rent_amount', 'deposit_amount', 'note', 'contract_file'];
  const setClauses = [];
  const params = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) { setClauses.push(`${key} = ?`); params.push(fields[key]); }
  }
  if (!setClauses.length) return 0;
  params.push(contractId);
  const [result] = await pool.query(`UPDATE contracts SET ${setClauses.join(', ')} WHERE contract_id = ?`, params);
  return result.affectedRows;
};

const updateStatus = async (contractId, status, executor = pool) => {
  const [result] = await executor.query(
    'UPDATE contracts SET status = ? WHERE contract_id = ?',
    [status, contractId]
  );
  return result.affectedRows;
};

module.exports = { findAll, findById, findActiveByRoom, findActiveByTenant, create, update, updateStatus };
