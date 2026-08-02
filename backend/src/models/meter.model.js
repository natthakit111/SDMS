/**
 * models/meter.model.js
 * Raw SQL query functions for the `meter_readings` table.
 */

const { pool } = require('../config/db');

const findAll = async ({ room_id, meter_type, month, year } = {}) => {
  let sql = `
    SELECT mr.*, r.room_number
    FROM meter_readings mr
    JOIN rooms r ON mr.room_id = r.room_id
    WHERE 1=1
  `;
  const params = [];
  if (room_id)    { sql += ' AND mr.room_id = ?';    params.push(room_id); }
  if (meter_type) { sql += ' AND mr.meter_type = ?'; params.push(meter_type); }
  if (month)      { sql += ' AND mr.reading_month = ?'; params.push(month); }
  if (year)       { sql += ' AND mr.reading_year = ?';  params.push(year); }
  sql += ' ORDER BY mr.reading_year DESC, mr.reading_month DESC, r.room_number';
  const [rows] = await pool.query(sql, params);
  return rows;
};

const findById = async (readingId) => {
  const [rows] = await pool.query(
    `SELECT mr.*, r.room_number FROM meter_readings mr
     JOIN rooms r ON mr.room_id = r.room_id
     WHERE mr.reading_id = ? LIMIT 1`,
    [readingId]
  );
  return rows[0] || null;
};

// Get the most recent reading for a room+type (to auto-fill "previous unit")
const findLatestByRoomAndType = async (roomId, meterType) => {
  const [rows] = await pool.query(
    `SELECT * FROM meter_readings
     WHERE room_id = ? AND meter_type = ?
     ORDER BY reading_year DESC, reading_month DESC
     LIMIT 1`,
    [roomId, meterType]
  );
  return rows[0] || null;
};

// Find reading for a specific room/type/month/year
const findByRoomMonthYear = async (roomId, meterType, month, year) => {
  const [rows] = await pool.query(
    `SELECT * FROM meter_readings
     WHERE room_id = ? AND meter_type = ? AND reading_month = ? AND reading_year = ?
     LIMIT 1`,
    [roomId, meterType, month, year]
  );
  return rows[0] || null;
};

const create = async ({ room_id, meter_type, reading_month, reading_year,
                        previous_unit, current_unit, rate_per_unit,
                        image_path, recorded_by }) => {
  const [result] = await pool.query(
    `INSERT INTO meter_readings
       (room_id, meter_type, reading_month, reading_year,
        previous_unit, current_unit, rate_per_unit, image_path, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [room_id, meter_type, reading_month, reading_year,
     previous_unit, current_unit, rate_per_unit,
     image_path || null, recorded_by || null]
  );
  return result.insertId;
};

const update = async (readingId, fields) => {
  const allowed = ['current_unit', 'rate_per_unit', 'image_path'];
  const keys = Object.keys(fields).filter(k => allowed.includes(k));
  if (keys.length === 0) return 0;
  // Recalculate previous_unit stays, only current_unit / rate changes
  const sql = `UPDATE meter_readings SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE reading_id = ?`;
  const [result] = await pool.query(sql, [...keys.map(k => fields[k]), readingId]);
  return result.affectedRows;
};

// หาห้องที่มีสัญญา active ครอบคลุมเดือน/ปีที่จะบันทึกมิเตอร์
// และยังไม่ได้บันทึกมิเตอร์ครบทั้งไฟและน้ำของเดือน/ปีนั้น
const findAvailableRoomsForMeter = async (month, year) => {
  const [rows] = await pool.query(`
    SELECT DISTINCT
      r.room_id, r.room_number,
      CONCAT(t.first_name, ' ', t.last_name) AS tenant_name
    FROM rooms r
    JOIN contracts c ON c.room_id = r.room_id AND c.status = 'active'
    JOIN tenants   t ON t.tenant_id = c.tenant_id
    WHERE c.start_date <= LAST_DAY(STR_TO_DATE(CONCAT(?, '-', ?, '-01'), '%Y-%m-%d'))
      AND c.end_date   >= STR_TO_DATE(CONCAT(?, '-', ?, '-01'), '%Y-%m-%d')
      AND NOT EXISTS (
        SELECT 1 FROM meter_readings me
        WHERE me.room_id = r.room_id
          AND me.meter_type = 'electric'
          AND me.reading_month = ? AND me.reading_year = ?
      )
      AND NOT EXISTS (
        SELECT 1 FROM meter_readings mw
        WHERE mw.room_id = r.room_id
          AND mw.meter_type = 'water'
          AND mw.reading_month = ? AND mw.reading_year = ?
      )
    ORDER BY r.room_number ASC
  `, [year, month, year, month, month, year, month, year]);
  return rows;
};

module.exports = {
  findAll, findById, findLatestByRoomAndType,
  findByRoomMonthYear, create, update,findAvailableRoomsForMeter,
};
