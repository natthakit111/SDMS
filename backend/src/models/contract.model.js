/**
 * models/contract.model.js
 * Raw SQL query functions for the `contracts` table.
 */

const { pool } = require('../config/db');

const buildListWhere = ({ status = null, tenant_id = null, room_id = null, search = null } = {}) => {
  const conditions = [];
  const params = [];
  if (status)    { conditions.push('c.status = ?');    params.push(status); }
  if (tenant_id) { conditions.push('c.tenant_id = ?'); params.push(tenant_id); }
  if (room_id)   { conditions.push('c.room_id = ?');   params.push(room_id); }
  // ⚠️ เดิม frontend ค้นหา tenant_name/room_number/contract_id เองฝั่ง
  // client จากข้อมูลทั้งก้อน — ย้ายมาทำที่ query เพื่อให้ค้นหาได้ถูกต้อง
  // ข้ามทุกหน้า
  if (search) {
    conditions.push("(CONCAT(t.first_name,' ',t.last_name) LIKE ? OR r.room_number LIKE ? OR CAST(c.contract_id AS CHAR) LIKE ?)");
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  return { where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '', params };
};

const findAll = async ({ status = null, tenant_id = null, room_id = null, search = null, limit = null, offset = 0 } = {}) => {
  const { where, params } = buildListWhere({ status, tenant_id, room_id, search });
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
    LEFT JOIN deposits d ON d.contract_id = c.contract_id
    ${where}
    ORDER BY c.created_at DESC`;
  const queryParams = [...params];
  if (limit !== null) {
    sql += ' LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);
  }
  const [rows] = await pool.query(sql, queryParams);
  return rows;
};

const countAll = async ({ status = null, tenant_id = null, room_id = null, search = null } = {}) => {
  const { where, params } = buildListWhere({ status, tenant_id, room_id, search });
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM contracts c
     JOIN tenants t ON c.tenant_id = t.tenant_id
     JOIN rooms   r ON c.room_id   = r.room_id
     ${where}`,
    params
  );
  return rows[0].total;
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

module.exports = { findAll, countAll, findById, findActiveByRoom, findActiveByTenant, create, update, updateStatus };
