/**
 * models/meter.model.js
 * Raw SQL query functions for the `meter_readings` table.
 */

const { pool } = require('../config/db');

const buildListWhere = ({ room_id, meter_type, month, year, search } = {}) => {
  const clauses = ['1=1'];
  const params = [];
  if (room_id)    { clauses.push('mr.room_id = ?');    params.push(room_id); }
  if (meter_type) { clauses.push('mr.meter_type = ?'); params.push(meter_type); }
  if (month)      { clauses.push('mr.reading_month = ?'); params.push(month); }
  if (year)       { clauses.push('mr.reading_year = ?');  params.push(year); }
  if (search)     { clauses.push('r.room_number LIKE ?'); params.push(`%${search}%`); }
  return { where: clauses.join(' AND '), params };
};

// ⚠️ FIX: หน้า /admin/meters แสดงผลแบบ "1 แถวต่อห้อง/เดือน" (รวมค่าไฟ+น้ำไว้
// แถวเดียวกัน — ดู `grouped` ใน frontend) แต่เดิม findAll/countAll paginate
// และนับจากตาราง meter_readings ตรงๆ ซึ่งเป็น "1 แถวต่อประเภทมิเตอร์" (ห้อง
// ที่บันทึกครบทั้งไฟ+น้ำ = 2 แถวดิบ) ทำให้ตัวเลข total ที่โชว์เป็นสองเท่าของ
// จำนวนห้องที่มีการบันทึกจริง และที่ร้ายกว่านั้นคือ LIMIT/OFFSET ตัดที่แถวดิบ
// อาจตัดค่าไฟกับค่าน้ำของห้องเดียวกัน (เดือนเดียวกัน) ให้ไปคนละหน้ากันได้ถ้า
// ดันไปอยู่คาบเกี่ยวขอบหน้าพอดี ทำให้บางห้องโชว์ข้อมูลไม่ครบในหน้าใดหน้าหนึ่ง
//
// แก้โดย paginate ที่ระดับกลุ่ม (room_id, reading_month, reading_year) ก่อน
// แล้วค่อยดึงทุกแถวดิบของกลุ่มที่เลือกมาในขั้นที่สอง — กัน group ถูกตัดขาด
// ระหว่างหน้า และนับ/แบ่งหน้าตรงกับจำนวนห้องที่แสดงจริงบนหน้าเว็บ
const findAll = async ({ room_id, meter_type, month, year, search, limit = null, offset = 0 } = {}) => {
  const { where, params } = buildListWhere({ room_id, meter_type, month, year, search });

  let groupSql = `
    SELECT DISTINCT mr.room_id, mr.reading_month, mr.reading_year, r.room_number
    FROM meter_readings mr
    JOIN rooms r ON mr.room_id = r.room_id
    WHERE ${where}
    ORDER BY mr.reading_year DESC, mr.reading_month DESC, r.room_number
  `;
  const groupParams = [...params];
  if (limit !== null) {
    groupSql += ' LIMIT ? OFFSET ?';
    groupParams.push(limit, offset);
  }
  const [groups] = await pool.query(groupSql, groupParams);
  if (groups.length === 0) return [];

  const groupConds = groups
    .map(() => '(mr.room_id = ? AND mr.reading_month = ? AND mr.reading_year = ?)')
    .join(' OR ');
  const groupValueParams = groups.flatMap((g) => [g.room_id, g.reading_month, g.reading_year]);

  // ยังต้องเคารพ meter_type filter ถ้ามีคนเรียกระบุมา (เช่นอยากได้เฉพาะ
  // ประเภทไฟฟ้า) — group ข้างบนคำนวณจาก filter เดียวกันอยู่แล้วเลย re-apply
  // เฉพาะ meter_type ซ้ำตรงนี้พอ (room_id/month/year ล็อกจาก group แล้ว)
  const typeClause = meter_type ? ' AND mr.meter_type = ?' : '';
  const typeParams = meter_type ? [meter_type] : [];

  const [rows] = await pool.query(
    `SELECT mr.*, r.room_number
     FROM meter_readings mr
     JOIN rooms r ON mr.room_id = r.room_id
     WHERE (${groupConds})${typeClause}
     ORDER BY mr.reading_year DESC, mr.reading_month DESC, r.room_number`,
    [...groupValueParams, ...typeParams]
  );
  return rows;
};

const countAll = async ({ room_id, meter_type, month, year, search } = {}) => {
  const { where, params } = buildListWhere({ room_id, meter_type, month, year, search });
  // ⚠️ FIX: ต้อง JOIN rooms เหมือน findAll เสมอ — buildListWhere ใช้ r.room_number
  // ในเงื่อนไข search ถ้าไม่ join จะพัง 500 ทุกครั้งที่มี search (เจอบั๊กนี้
  // ตอนทดสอบสดผ่านเบราว์เซอร์จริงก่อน commit)
  // ⚠️ FIX: นับกลุ่ม (room_id, month, year) ไม่ใช่แถวดิบ — เหตุผลเดียวกับ
  // findAll ด้านบน (ไม่งั้น total จะเป็นสองเท่าของจำนวนห้องที่แสดงจริง)
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM (
       SELECT DISTINCT mr.room_id, mr.reading_month, mr.reading_year
       FROM meter_readings mr
       JOIN rooms r ON mr.room_id = r.room_id
       WHERE ${where}
     ) g`,
    params
  );
  return rows[0].total;
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
  findAll, countAll, findById, findLatestByRoomAndType,
  findByRoomMonthYear, create, update,findAvailableRoomsForMeter,
};
