/**
 * models/room.model.js
 * Raw SQL query functions for the `rooms` table.
 */

const { pool } = require('../config/db');

const findAll = async ({ status = null, floor = null } = {}) => {
  let sql = 'SELECT * FROM rooms';
  const conditions = [];
  const params = [];
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (floor)  { conditions.push('floor = ?');  params.push(floor); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY floor ASC, room_number ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
};

const findById = async (roomId) => {
  const [rows] = await pool.query('SELECT * FROM rooms WHERE room_id = ? LIMIT 1', [roomId]);
  return rows[0] || null;
};

const findByRoomNumber = async (roomNumber) => {
  const [rows] = await pool.query('SELECT * FROM rooms WHERE room_number = ? LIMIT 1', [roomNumber]);
  return rows[0] || null;
};

const create = async ({ room_number, floor, room_type, area_sqm, base_rent, status = 'available', description }) => {
  const [result] = await pool.query(
    `INSERT INTO rooms (room_number, floor, room_type, area_sqm, base_rent, status, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [room_number, floor, room_type, area_sqm || null, base_rent, status, description || null]
  );
  return result.insertId;
};

const update = async (roomId, fields) => {
  const allowed = ['room_number', 'floor', 'room_type', 'area_sqm', 'base_rent', 'status', 'description'];
  const setClauses = [];
  const params = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) { setClauses.push(`${key} = ?`); params.push(fields[key]); }
  }
  if (!setClauses.length) return 0;
  params.push(roomId);
  const [result] = await pool.query(`UPDATE rooms SET ${setClauses.join(', ')} WHERE room_id = ?`, params);
  return result.affectedRows;
};

const updateStatus = async (roomId, status, executor = pool) => {
  const [result] = await executor.query('UPDATE rooms SET status = ? WHERE room_id = ?', [status, roomId]);
  return result.affectedRows;
};

const remove = async (roomId) => {
  const [result] = await pool.query('DELETE FROM rooms WHERE room_id = ?', [roomId]);
  return result.affectedRows;
};

const getSummaryStats = async () => {
  const [rows] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       SUM(status = 'available')   AS available,
       SUM(status = 'occupied')    AS occupied,
       SUM(status = 'maintenance') AS maintenance
     FROM rooms`
  );
  return rows[0];
};

module.exports = { findAll, findById, findByRoomNumber, create, update, updateStatus, remove, getSummaryStats };
