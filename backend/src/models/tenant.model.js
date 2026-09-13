/**
 * models/tenant.model.js
 * Raw SQL query functions for the `tenants` table.
 */

const { pool } = require('../config/db');

// ── WHERE clause ที่ findAll/count ใช้ร่วมกัน กันสองจุดเขียนเงื่อนไขไม่ตรงกัน ──
const buildListWhere = ({ search = null, isActive = true, contractStatus = null } = {}) => {
  const clauses = ['u.is_active = ?'];
  const params = [isActive ? 1 : 0];
  if (search) {
    clauses.push('(t.first_name LIKE ? OR t.last_name LIKE ? OR t.phone LIKE ? OR t.id_card_number LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  // ⚠️ เดิม frontend กรอง contract_status (active/no_contract) เองฝั่ง
  // client จากข้อมูลทั้งก้อนที่ดึงมาทีเดียว — ตอนนี้ดึงทีละหน้าแล้ว ต้อง
  // ย้าย filter นี้มาทำที่ query เพื่อให้ total/pagination ถูกต้องจริง
  if (contractStatus === 'active') {
    clauses.push("c.status = 'active'");
  } else if (contractStatus === 'no_contract') {
    clauses.push('c.contract_id IS NULL');
  }
  return { where: clauses.join(' AND '), params };
};

const findAll = async ({ search = null, isActive = true, contractStatus = null, limit = null, offset = 0 } = {}) => {
  const { where, params } = buildListWhere({ search, isActive, contractStatus });
  let sql = `
    SELECT
      t.*,
      u.username, u.telegram_chat_id, u.is_active,
      r.room_number, r.room_id,
      c.contract_id, c.status AS contract_status
    FROM tenants t
    JOIN users u ON t.user_id = u.user_id
    LEFT JOIN contracts c ON c.tenant_id = t.tenant_id AND c.status = 'active'
    LEFT JOIN rooms r ON r.room_id = c.room_id
    WHERE ${where}
    ORDER BY t.created_at DESC`;
  const queryParams = [...params];
  if (limit !== null) {
    sql += ' LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);
  }
  const [rows] = await pool.query(sql, queryParams);
  return rows;
};

const countAll = async ({ search = null, isActive = true, contractStatus = null } = {}) => {
  const { where, params } = buildListWhere({ search, isActive, contractStatus });
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM tenants t
     JOIN users u ON t.user_id = u.user_id
     LEFT JOIN contracts c ON c.tenant_id = t.tenant_id AND c.status = 'active'
     WHERE ${where}`,
    params
  );
  return rows[0].total;
};

const findById = async (tenantId) => {
  const [rows] = await pool.query(
    `SELECT t.*, u.username, u.telegram_chat_id, u.is_active
     FROM tenants t JOIN users u ON t.user_id = u.user_id
     WHERE t.tenant_id = ? LIMIT 1`,
    [tenantId]
  );
  return rows[0] || null;
};

const findByUserId = async (userId) => {
  const [rows] = await pool.query('SELECT * FROM tenants WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] || null;
};

const findByIdCard = async (idCardNumber) => {
  const [rows] = await pool.query(
    'SELECT * FROM tenants WHERE id_card_number = ? LIMIT 1',
    [idCardNumber]
  );
  return rows[0] || null;
};

const update = async (tenantId, fields, conn = null) => {
  const allowed = [
    'first_name', 'last_name', 'phone', 'email', 'id_card_number', 'id_type', 'is_placeholder_id',
    'emergency_contact_name', 'emergency_contact_phone', 'profile_image',
  ];
  const setClauses = [];
  const params = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) { setClauses.push(`${key} = ?`); params.push(fields[key]); }
  }
  if (!setClauses.length) return 0;
  params.push(tenantId);
  const runner = conn || pool; // ✅ มีอยู่แล้ว ไม่ต้องแก้
  const [result] = await runner.query(`UPDATE tenants SET ${setClauses.join(', ')} WHERE tenant_id = ?`, params);
  return result.affectedRows;
};

// ── ใช้ใน authController.register: เช็คว่า phone/email ผูกกับ tenant อยู่แล้วหรือไม่ ──
const findConflictByPhoneOrEmail = async (phone, email) => {
  const [rows] = await pool.query(
    `SELECT tenant_id, phone, email FROM tenants
     WHERE phone = ? OR (? IS NOT NULL AND ? != '' AND email = ?)
     LIMIT 1`,
    [phone, email || null, email || '', email || null]
  );
  return rows[0] || null;
};

// ── ใช้ใน authController.register: สร้าง tenant record แบบ placeholder ──
// ⚠️ FIX: เปลี่ยนจาก INSERT IGNORE (เงียบเมื่อชน unique constraint) เป็น
// INSERT ธรรมดา — ต้องรับ conn เข้ามาเพื่ออยู่ใน transaction เดียวกับ
// createUser ใน authController.register ถ้า insert ล้มเหลว error จะ
// propagate ขึ้นไปให้ transaction rollback ทั้งคู่ ไม่ทิ้ง orphaned user
const createFromSelfRegistration = async (conn, { userId, firstName, lastName, phone, email }) => {
  const placeholderIdCard = `REG${String(userId).padStart(9, '0')}`;
  await conn.query(
    `INSERT INTO tenants (user_id, first_name, last_name, id_card_number, is_placeholder_id, phone, email)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [userId, firstName, lastName || 'ไม่ระบุ', placeholderIdCard, phone || '0000000000', email || null]
  );
};

// ── ใช้ใน tenantController.createTenant: หา record เดิมที่ผูกกับ phone หรือ email นี้ ──
// ── ใช้ใน contractController: เช็คว่า id_card_number ชนกับ tenant คนอื่นไหม ──
const findIdCardConflictExcluding = async (idCardNumber, excludeTenantId) => {
  const [rows] = await pool.query(
    `SELECT tenant_id FROM tenants WHERE id_card_number = ? AND tenant_id != ? LIMIT 1`,
    [idCardNumber, excludeTenantId]
  );
  return rows[0] || null;
};

// ── ใช้ใน tenantController.createTenant: สร้าง tenant ใหม่ทั้งหมด (ต้องอยู่ใน transaction เดียวกับ conn) ──
const createFull = async (conn, userId, data) => {
  const {
    first_name, last_name, id_card_number, id_type, phone, email,
    emergency_contact_name, emergency_contact_phone,
  } = data;
  const [result] = await conn.query(
    `INSERT INTO tenants
       (user_id, first_name, last_name, id_card_number, id_type, is_placeholder_id, phone, email,
        emergency_contact_name, emergency_contact_phone)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [userId, first_name, last_name, id_card_number, id_type || 'thai_id', phone,
     email || null, emergency_contact_name || null, emergency_contact_phone || null]
  );
  return result.insertId;
};

// ── ใช้ใน telegram.routes.js POST /broadcast: นับ tenant ที่ active + เชื่อม Telegram แล้ว ──
// ป้องกันการนับผู้ใช้ซ้ำ (Overcounting) กรณีที่ 1 คนมีหลายสัญญาเช่า
const countActiveWithTelegram = async () => {
  const [rows] = await pool.query(
    `SELECT COUNT(DISTINCT u.user_id) AS total 
     FROM users u
     JOIN tenants t ON u.user_id = t.user_id
     JOIN contracts c ON c.tenant_id = t.tenant_id AND c.status = 'active'
     WHERE u.is_active = 1 AND u.telegram_chat_id IS NOT NULL`
  );
  return rows[0]?.total ?? 0;
};

module.exports = {
  findAll, countAll, findById, findByUserId, findByIdCard, update,
  findConflictByPhoneOrEmail, createFromSelfRegistration,
  findIdCardConflictExcluding, createFull, countActiveWithTelegram,
};