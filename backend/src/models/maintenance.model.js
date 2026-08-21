/**
 * models/maintenance.model.js
 * Raw SQL query functions for the `maintenance_requests` table.
 *
 * NEW: findById now also selects u_t.user_id — required by
 * TelegramService.sendMaintenanceUpdate() to check the tenant's
 * notify_maintenance preference (mute setting). Without it, that
 * function silently fail-opens (always sends, mute has no effect).
 */

const { pool } = require('../config/db');

const buildListWhere = ({ status, priority, room_id, tenant_id, search = null } = {}) => {
  const clauses = ['1=1'];
  const params = [];
  if (status)    { clauses.push('mr.status = ?');    params.push(status); }
  if (priority)  { clauses.push('mr.priority = ?');  params.push(priority); }
  if (room_id)   { clauses.push('mr.room_id = ?');   params.push(room_id); }
  if (tenant_id) { clauses.push('mr.tenant_id = ?'); params.push(tenant_id); }
  // ⚠️ เดิม frontend ค้นหา room_number/category/tenant_name เองฝั่ง client
  // จากข้อมูลทั้งก้อน — ย้ายมาทำที่ query เพื่อให้ค้นหาได้ถูกต้องข้ามทุกหน้า
  if (search) {
    clauses.push("(r.room_number LIKE ? OR mr.category LIKE ? OR CONCAT(t.first_name,' ',t.last_name) LIKE ?)");
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  return { where: clauses.join(' AND '), params };
};

const findAll = async ({ status, priority, room_id, tenant_id, search = null, limit = null, offset = 0 } = {}) => {
  const { where, params } = buildListWhere({ status, priority, room_id, tenant_id, search });
  let sql = `
    SELECT mr.*,
           r.room_number,
           CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
           t.phone AS tenant_phone,
           u.username AS assigned_username
    FROM maintenance_requests mr
    JOIN rooms   r  ON mr.room_id   = r.room_id
    JOIN tenants t  ON mr.tenant_id = t.tenant_id
    LEFT JOIN users u ON mr.assigned_to = u.user_id
    WHERE ${where}
    ORDER BY FIELD(mr.priority,"high","medium","low"), mr.created_at DESC
  `;
  const queryParams = [...params];
  if (limit !== null) {
    sql += ' LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);
  }
  const [rows] = await pool.query(sql, queryParams);
  return rows;
};

const countAll = async ({ status, priority, room_id, tenant_id, search = null } = {}) => {
  const { where, params } = buildListWhere({ status, priority, room_id, tenant_id, search });
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM maintenance_requests mr
     JOIN rooms   r ON mr.room_id   = r.room_id
     JOIN tenants t ON mr.tenant_id = t.tenant_id
     WHERE ${where}`,
    params
  );
  return rows[0].total;
};

const findById = async (requestId) => {
  const [rows] = await pool.query(`
    SELECT mr.*,
           r.room_number,
           CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
           t.phone AS tenant_phone,
           u_t.user_id AS user_id,
           u_t.telegram_chat_id,
           u_a.username AS assigned_username
    FROM maintenance_requests mr
    JOIN rooms   r   ON mr.room_id    = r.room_id
    JOIN tenants t   ON mr.tenant_id  = t.tenant_id
    JOIN users   u_t ON t.user_id     = u_t.user_id
    LEFT JOIN users u_a ON mr.assigned_to = u_a.user_id
    WHERE mr.request_id = ? LIMIT 1
  `, [requestId]);
  return rows[0] || null;
};

const findByTenantId = async (tenantId) => {
  const [rows] = await pool.query(`
    SELECT mr.*, r.room_number
    FROM maintenance_requests mr
    JOIN rooms r ON mr.room_id = r.room_id
    WHERE mr.tenant_id = ?
    ORDER BY mr.created_at DESC
  `, [tenantId]);
  return rows;
};

const create = async ({ tenant_id, room_id, category, description, image_path, priority }) => {
  const [result] = await pool.query(
    `INSERT INTO maintenance_requests
       (tenant_id, room_id, category, description, image_path, priority)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tenant_id, room_id, category, description, image_path || null, priority || 'medium']
  );
  return result.insertId;
};

const updateStatus = async (requestId, status, adminNote = null, assignedTo = null) => {
  const resolved_at = status === 'resolved' ? new Date() : null;
  const [result] = await pool.query(
    `UPDATE maintenance_requests
     SET status = ?, admin_note = COALESCE(?, admin_note),
         assigned_to = COALESCE(?, assigned_to),
         resolved_at = COALESCE(?, resolved_at)
     WHERE request_id = ?`,
    [status, adminNote, assignedTo, resolved_at, requestId]
  );
  return result.affectedRows;
};

const getStatusSummary = async () => {
  const [rows] = await pool.query(`
    SELECT
      COUNT(*)                           AS total,
      SUM(status = 'pending')            AS pending,
      SUM(status = 'in_progress')        AS in_progress,
      SUM(status = 'resolved')           AS resolved,
      SUM(priority = 'high' AND status != 'resolved') AS high_priority_open
    FROM maintenance_requests
  `);
  return rows[0];
};

module.exports = { findAll, countAll, findById, findByTenantId, create, updateStatus, getStatusSummary };