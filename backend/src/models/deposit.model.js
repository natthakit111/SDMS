/**
 * models/deposit.model.js
 */
const { pool } = require('../config/db');

// สร้าง deposit record ใหม่ตอนทำสัญญา (status = holding)
const create = async ({ contract_id, tenant_id, total_deposit }) => {
  const [result] = await pool.query(
    `INSERT INTO deposits (contract_id, tenant_id, total_deposit, status)
     VALUES (?, ?, ?, 'holding')`,
    [contract_id, tenant_id, total_deposit]
  );
  return result.insertId;
};

const findByContract = async (contract_id) => {
  const [rows] = await pool.query(
    `SELECT * FROM deposits WHERE contract_id = ? LIMIT 1`,
    [contract_id]
  );
  return rows[0] || null;
};

const findById = async (deposit_id) => {
  const [rows] = await pool.query(
    `SELECT * FROM deposits WHERE deposit_id = ? LIMIT 1`,
    [deposit_id]
  );
  return rows[0] || null;
};

// ปิดเงินประกัน: บันทึกยอดหัก + ยอดคืน + ใครเป็นคนดำเนินการ
const finalizeRefund = async (
  deposit_id,
  { deduction = 0, deduction_note = null, refund_amount, processed_by, move_out_request_id = null }
) => {
  await pool.query(
    `UPDATE deposits
     SET deduction = ?, deduction_note = ?, refund_amount = ?, refund_date = CURDATE(),
         status = 'refunded', processed_by = ?,
         move_out_request_id = COALESCE(?, move_out_request_id)
     WHERE deposit_id = ?`,
    [deduction, deduction_note, refund_amount, processed_by, move_out_request_id, deposit_id]
  );
};

// รายการทั้งหมด join กับ contracts/tenants/rooms — ใช้กับหน้า admin/deposits
const findAllWithDetails = async () => {
  const [rows] = await pool.query(`
    SELECT
      c.contract_id, c.tenant_id, c.room_id,
      CONCAT(t.first_name, ' ', t.last_name) AS tenant_name,
      r.room_number, c.rent_amount, c.deposit_amount,
      c.start_date, c.end_date, c.status,
      d.deposit_id, d.status AS raw_deposit_status,
      d.deduction, d.refund_amount, d.refund_date, d.deduction_note
    FROM contracts c
    JOIN tenants t ON t.tenant_id = c.tenant_id
    JOIN rooms r   ON r.room_id   = c.room_id
    LEFT JOIN deposits d ON d.contract_id = c.contract_id
    WHERE c.deposit_amount > 0
    ORDER BY c.created_at DESC
  `);
  return rows;
};

module.exports = { create, findByContract, findById, finalizeRefund, findAllWithDetails };
