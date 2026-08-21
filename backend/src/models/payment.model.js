/**
 * models/payment.model.js
 * Raw SQL query functions for the `payments` table.
 */

const { pool } = require('../config/db');

const buildListWhere = ({ tenant_id, bill_id, status, payment_method } = {}) => {
  const clauses = ['1=1'];
  const params = [];
  if (tenant_id) { clauses.push('p.tenant_id = ?'); params.push(tenant_id); }
  if (bill_id)   { clauses.push('p.bill_id = ?');   params.push(bill_id); }
  if (status)    { clauses.push('p.status = ?');    params.push(status); }
  if (payment_method) { clauses.push('p.payment_method = ?'); params.push(payment_method); }
  return { where: clauses.join(' AND '), params };
};

const findAll = async ({ tenant_id, bill_id, status, payment_method, limit = null, offset = 0 } = {}) => {
  const { where, params } = buildListWhere({ tenant_id, bill_id, status, payment_method });
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
    WHERE ${where}
    ORDER BY p.paid_at DESC
  `;
  const queryParams = [...params];
  if (limit !== null) {
    sql += ' LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);
  }
  const [rows] = await pool.query(sql, queryParams);
  return rows;
};

const countAll = async ({ tenant_id, bill_id, status, payment_method } = {}) => {
  const { where, params } = buildListWhere({ tenant_id, bill_id, status, payment_method });
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM payments p
     JOIN bills   b ON p.bill_id   = b.bill_id
     JOIN tenants t ON p.tenant_id = t.tenant_id
     WHERE ${where}`,
    params
  );
  return rows[0].total;
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

const verify = async (paymentId, adminUserId, status, remark = null, executor = pool) => {
  const [result] = await executor.query(
    `UPDATE payments
     SET status = ?, verified_by = ?, verified_at = NOW(), remark = ?
     WHERE payment_id = ? AND status = 'pending_verify'`,
    [status, adminUserId, remark, paymentId]
  );
  return result.affectedRows;
};

const updateSlipImage = async (paymentId, slipImage) => {
  await pool.query('UPDATE payments SET slip_image = ? WHERE payment_id = ?', [slipImage, paymentId]);
};

module.exports = { findAll, countAll, findById, findByBillId, findPendingByTenant, create, verify, updateSlipImage };
