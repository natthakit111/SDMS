/**
 * models/payment.model.js
 * Raw SQL query functions for the `payments` table.
 */

const { pool } = require('../config/db');

const findAll = async ({ tenant_id, bill_id, status, payment_method, } = {}) => {
  let sql = `
    SELECT p.*,
           b.bill_month, b.bill_year, b.total_amount AS bill_total,
           r.room_number,
           CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
           u.username AS verified_by_name
    FROM payments p
    JOIN bills    b  ON p.bill_id   = b.bill_id
    JOIN rooms    r  ON b.room_id   = r.room_id
    JOIN tenants  t  ON p.tenant_id = t.tenant_id
    LEFT JOIN users u ON p.verified_by = u.user_id
    WHERE 1=1
  `;
  const params = [];
  if (tenant_id) { sql += ' AND p.tenant_id = ?'; params.push(tenant_id); }
  if (bill_id)   { sql += ' AND p.bill_id = ?';   params.push(bill_id); }
  if (status)    { sql += ' AND p.status = ?';    params.push(status); }
  if (payment_method) { sql += ' AND p.payment_method = ?'; params.push(payment_method); }
  sql += ' ORDER BY p.paid_at DESC';
  const [rows] = await pool.query(sql, params);
  return rows;
};

const findById = async (paymentId) => {
  const [rows] = await pool.query(`
    SELECT p.*,
           b.bill_month, b.bill_year, b.total_amount AS bill_total, b.status AS bill_status,
           r.room_number,
           CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
           t.tenant_id, u_t.telegram_chat_id,
           u_v.username AS verified_by_name
    FROM payments p
    JOIN bills    b   ON p.bill_id    = b.bill_id
    JOIN rooms    r   ON b.room_id    = r.room_id
    JOIN tenants  t   ON p.tenant_id  = t.tenant_id
    JOIN users    u_t ON t.user_id    = u_t.user_id
    LEFT JOIN users u_v ON p.verified_by = u_v.user_id
    WHERE p.payment_id = ? LIMIT 1
  `, [paymentId]);
  return rows[0] || null;
};

const findByBillId = async (billId) => {
  const [rows] = await pool.query(
    `SELECT * FROM payments WHERE bill_id = ? ORDER BY paid_at DESC`,
    [billId]
  );
  return rows;
};

const findPendingByTenant = async (tenantId) => {
  const [rows] = await pool.query(
    `SELECT p.*, b.bill_month, b.bill_year, r.room_number
     FROM payments p
     JOIN bills b ON p.bill_id = b.bill_id
     JOIN rooms r ON b.room_id = r.room_id
     WHERE p.tenant_id = ? AND p.status = 'pending_verify'
     ORDER BY p.paid_at DESC`,
    [tenantId]
  );
  return rows;
};

const create = async ({ bill_id, tenant_id, amount_paid, payment_method, slip_image }) => {
  const [result] = await pool.query(
    `INSERT INTO payments (bill_id, tenant_id, amount_paid, payment_method, slip_image)
     VALUES (?, ?, ?, ?, ?)`,
    [bill_id, tenant_id, amount_paid, payment_method || 'qr_promptpay', slip_image || null]
  );
  return result.insertId;
};

const verify = async (paymentId, adminUserId, status, remark = null) => {
  const [result] = await pool.query(
    `UPDATE payments
     SET status = ?, verified_by = ?, verified_at = NOW(), remark = ?
     WHERE payment_id = ?`,
    [status, adminUserId, remark, paymentId]
  );
  return result.affectedRows;
};

const updateSlipImage = async (paymentId, slipImage) => {
  await pool.query('UPDATE payments SET slip_image = ? WHERE payment_id = ?', [slipImage, paymentId]);
};

module.exports = { findAll, findById, findByBillId, findPendingByTenant, create, verify, updateSlipImage };
