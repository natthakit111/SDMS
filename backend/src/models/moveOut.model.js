/**
 * models/moveOut.model.js
 * Raw SQL query functions for the `move_out_requests` table.
 */

const { pool } = require('../config/db');

const BASE_SELECT = `
  SELECT r.*, t.first_name, t.last_name, ro.room_number
  FROM move_out_requests r
  JOIN tenants t  ON t.tenant_id  = r.tenant_id
  JOIN rooms ro   ON ro.room_id   = r.room_id`;

// admin: ทุกคำร้อง | tenant: เฉพาะของตัวเอง (กรองด้วย tenantId)
const findAll = async ({ tenantId = null } = {}) => {
  let sql = BASE_SELECT;
  const params = [];
  if (tenantId) {
    sql += ' WHERE r.tenant_id = ?';
    params.push(tenantId);
  }
  sql += ' ORDER BY r.created_at DESC';
  const [rows] = await pool.query(sql, params);
  return rows;
};

const findById = async (requestId) => {
  const [rows] = await pool.query(
    `${BASE_SELECT} WHERE r.request_id = ? LIMIT 1`,
    [requestId]
  );
  return rows[0] || null;
};

// เช็คว่าผู้เช่ามีคำร้องที่ยังรอการอนุมัติอยู่หรือไม่ (ห้ามส่งซ้ำซ้อน)
const hasPendingRequest = async (tenantId) => {
  const [rows] = await pool.query(
    `SELECT request_id FROM move_out_requests
     WHERE tenant_id = ? AND status = 'pending' LIMIT 1`,
    [tenantId]
  );
  return rows.length > 0;
};

const create = async ({ tenant_id, contract_id, room_id, move_out_date, reason }) => {
  const [result] = await pool.query(
    `INSERT INTO move_out_requests
       (tenant_id, contract_id, room_id, move_out_date, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [tenant_id, contract_id, room_id, move_out_date, reason]
  );
  return result.insertId;
};

//  เพิ่ม actual_move_out_date เป็น optional (reject ไม่ต้องส่งมา จะเป็น NULL)
const updateReviewStatus = async (requestId, status, { admin_note = null, reviewed_by, actual_move_out_date = null }, executor = pool) => {
  const [result] = await executor.query(
    `UPDATE move_out_requests
     SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW(), actual_move_out_date = ?
     WHERE request_id = ?`,
    [status, admin_note, reviewed_by, actual_move_out_date, requestId]
  );
  return result.affectedRows;
};

module.exports = { findAll, findById, hasPendingRequest, create, updateReviewStatus };