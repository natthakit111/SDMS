/**
 * models/bill.model.js
 * Raw SQL query functions for the `bills` table.
 */

const { pool } = require('../config/db');

const findAll = async ({ room_id, status, month, year, tenant_id } = {}) => {
  let sql = `
    SELECT b.*,
           r.room_number,
           CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
           t.tenant_id
    FROM bills b
    JOIN rooms     r ON b.room_id     = r.room_id
    JOIN contracts c ON b.contract_id = c.contract_id
    JOIN tenants   t ON c.tenant_id   = t.tenant_id
    WHERE 1=1
  `;
  const params = [];
  if (room_id)   { sql += ' AND b.room_id = ?';    params.push(room_id); }
  if (status)    { sql += ' AND b.status = ?';     params.push(status); }
  if (month)     { sql += ' AND b.bill_month = ?'; params.push(month); }
  if (year)      { sql += ' AND b.bill_year = ?';  params.push(year); }
  if (tenant_id) { sql += ' AND t.tenant_id = ?';  params.push(tenant_id); }
  sql += ' ORDER BY b.bill_year DESC, b.bill_month DESC, r.room_number';
  const [rows] = await pool.query(sql, params);
  return rows;
};

const findById = async (billId) => {
  const [rows] = await pool.query(`
    SELECT b.*,
           r.room_number, r.floor,
           CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
           t.phone AS tenant_phone, t.tenant_id,
           u.user_id, u.telegram_chat_id
    FROM bills b
    JOIN rooms     r ON b.room_id     = r.room_id
    JOIN contracts c ON b.contract_id = c.contract_id
    JOIN tenants   t ON c.tenant_id   = t.tenant_id
    JOIN users     u ON t.user_id     = u.user_id
    WHERE b.bill_id = ? LIMIT 1
  `, [billId]);
  return rows[0] || null;
};

const findByRoomMonthYear = async (roomId, month, year) => {
  const [rows] = await pool.query(
    `SELECT * FROM bills
     WHERE room_id = ? AND bill_month = ? AND bill_year = ?
       AND status != 'cancelled'
     LIMIT 1`,
    [roomId, month, year]
  );
  return rows[0] || null;
};

// All bills for a specific tenant (for tenant portal)
const findByTenantId = async (tenantId) => {
  const [rows] = await pool.query(`
    SELECT b.*, r.room_number
    FROM bills b
    JOIN rooms     r ON b.room_id     = r.room_id
    JOIN contracts c ON b.contract_id = c.contract_id
    WHERE c.tenant_id = ?
    ORDER BY b.bill_year DESC, b.bill_month DESC
  `, [tenantId]);
  return rows;
};

const create = async ({ contract_id, room_id, bill_month, bill_year,
                        rent_amount, electric_amount, water_amount,
                        other_amount, total_amount, due_date, note, qr_payload }) => {
  const [result] = await pool.query(
    `INSERT INTO bills
       (contract_id, room_id, bill_month, bill_year,
        rent_amount, electric_amount, water_amount, other_amount,
        total_amount, due_date, note, qr_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [contract_id, room_id, bill_month, bill_year,
     rent_amount, electric_amount || 0, water_amount || 0, other_amount || 0,
     total_amount, due_date, note || null, qr_payload || null]
  );
  return result.insertId;
};

const updateStatus = async (billId, status, executor = pool) => {
  const [result] = await executor.query(
    'UPDATE bills SET status = ? WHERE bill_id = ?',
    [status, billId]
  );
  return result.affectedRows;
};

const updateQrPayload = async (billId, qrPayload) => {
  await pool.query('UPDATE bills SET qr_payload = ? WHERE bill_id = ?', [qrPayload, billId]);
};

// Mark overdue bills (called by cron job)
const markOverdueBills = async () => {
  const [result] = await pool.query(
    `UPDATE bills SET status = 'overdue'
     WHERE status = 'pending' AND due_date < CURDATE()`
  );
  return result.affectedRows;
};

// Revenue summary by month (for reports)
const getMonthlyRevenue = async (year) => {
  const [rows] = await pool.query(`
    SELECT bill_month, bill_year,
           SUM(total_amount)    AS total_billed,
           SUM(rent_amount)     AS total_rent,
           SUM(electric_amount) AS total_electric,
           SUM(water_amount)    AS total_water,
           COUNT(*)             AS bill_count,
           SUM(status = 'paid') AS paid_count
    FROM bills
    WHERE bill_year = ? AND status != 'cancelled'
    GROUP BY bill_month, bill_year
    ORDER BY bill_month
  `, [year]);
  return rows;
};

module.exports = {
  findAll, findById, findByRoomMonthYear, findByTenantId,
  create, updateStatus, updateQrPayload, markOverdueBills, getMonthlyRevenue,
};

// Get bill detail WITH meter reading images (for tenant bill view — 13.2.2)
const findByIdWithMeters = async (billId) => {
  const [rows] = await pool.query(`
    SELECT b.*,
           r.room_number, r.floor,
           CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
           t.phone AS tenant_phone, t.tenant_id,
           u.telegram_chat_id,
           me.current_unit  AS elec_current,  me.previous_unit AS elec_previous,
           me.units_used    AS elec_units,     me.rate_per_unit AS elec_rate,
           me.image_path    AS elec_image,
           mw.current_unit  AS water_current,  mw.previous_unit AS water_previous,
           mw.units_used    AS water_units,    mw.rate_per_unit AS water_rate,
           mw.image_path    AS water_image
    FROM bills b
    JOIN rooms     r  ON b.room_id     = r.room_id
    JOIN contracts c  ON b.contract_id = c.contract_id
    JOIN tenants   t  ON c.tenant_id   = t.tenant_id
    JOIN users     u  ON t.user_id     = u.user_id
    LEFT JOIN meter_readings me ON me.room_id = b.room_id
      AND me.meter_type = 'electric'
      AND me.reading_month = b.bill_month AND me.reading_year = b.bill_year
    LEFT JOIN meter_readings mw ON mw.room_id = b.room_id
      AND mw.meter_type = 'water'
      AND mw.reading_month = b.bill_month AND mw.reading_year = b.bill_year
    WHERE b.bill_id = ? LIMIT 1
  `, [billId])
  return rows[0] || null
}

const findAvailableRoomsForBilling = async (month, year) => {
  const [rows] = await pool.query(`
    SELECT DISTINCT
      r.room_id, r.room_number, c.contract_id,
      CONCAT(t.first_name, ' ', t.last_name) AS tenant_name
    FROM rooms r
    JOIN contracts c ON c.room_id = r.room_id AND c.status = 'active'
    JOIN tenants   t ON t.tenant_id = c.tenant_id
    WHERE c.start_date <= LAST_DAY(STR_TO_DATE(CONCAT(?, '-', ?, '-01'), '%Y-%m-%d'))
      AND c.end_date   >= STR_TO_DATE(CONCAT(?, '-', ?, '-01'), '%Y-%m-%d')
      AND NOT EXISTS (
        SELECT 1 FROM bills b
        WHERE b.room_id = r.room_id
          AND b.bill_month = ?
          AND b.bill_year  = ?
          AND b.status != 'cancelled'
      )
    ORDER BY r.room_number ASC
  `, [year, month, year, month, month, year]);
  return rows;
};

module.exports = Object.assign(module.exports, { findByIdWithMeters, findAvailableRoomsForBilling });

