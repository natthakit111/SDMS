const { pool } = require('../config/db');
const DepositModel = require('../models/deposit.model');
const RoomModel = require('../models/room.model');
const { sendSuccess, sendNotFound, sendBadRequest } = require('../utils/response');

// GET /api/deposits — join ให้ตรงกับ shape ที่หน้า admin/deposits ต้องการ
const getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        c.contract_id, c.tenant_id, c.room_id,
        CONCAT(t.first_name, ' ', t.last_name) AS tenant_name,
        r.room_number, c.rent_amount, c.deposit_amount,
        c.start_date, c.end_date, c.status,
        d.status            AS raw_deposit_status,
        d.deduction, d.refund_amount, d.refund_date, d.deduction_note
      FROM contracts c
      JOIN tenants t ON t.tenant_id = c.tenant_id
      JOIN rooms r   ON r.room_id   = c.room_id
      LEFT JOIN deposits d ON d.contract_id = c.contract_id
      WHERE c.deposit_amount > 0
      ORDER BY c.created_at DESC
    `);

    // map ให้ตรงกับ 3 สถานะที่ frontend ใช้: held | refunded | deducted
    const data = rows.map((row) => {
      let deposit_status = 'held';
      if (row.raw_deposit_status === 'refunded') {
        deposit_status = Number(row.deduction) > 0 ? 'deducted' : 'refunded';
      }
      return {
        contract_id: row.contract_id,
        tenant_id: row.tenant_id,
        room_id: row.room_id,
        tenant_name: row.tenant_name,
        room_number: row.room_number,
        rent_amount: row.rent_amount,
        deposit_amount: row.deposit_amount,
        deposit_status,
        deposit_returned_at: row.refund_date,
        deposit_remark: row.deduction_note,
        start_date: row.start_date,
        end_date: row.end_date,
        status: row.status,
      };
    });

    return sendSuccess(res, data);
  } catch (err) { next(err); }
};

// PUT /api/deposits/:contract_id/refund  (admin only)
const refund = async (req, res, next) => {
  try {
    const { contract_id } = req.params;
    const { refund_amount, note } = req.body;

    if (refund_amount === undefined || isNaN(refund_amount) || refund_amount < 0) {
      return sendBadRequest(res, 'refund_amount ไม่ถูกต้อง');
    }

    const deposit = await DepositModel.findByContract(contract_id);
    if (!deposit) return sendNotFound(res, 'ไม่พบข้อมูลเงินประกันของสัญญานี้');
    if (deposit.status === 'refunded') return sendBadRequest(res, 'เงินประกันนี้ถูกคืนไปแล้ว');

    const total = Number(deposit.total_deposit);
    if (Number(refund_amount) > total) {
      return sendBadRequest(res, 'ยอดคืนเกินกว่าเงินประกันทั้งหมด');
    }
    const deduction = total - Number(refund_amount);

    const [[contract]] = await pool.query(
      `SELECT * FROM contracts WHERE contract_id = ?`, [contract_id]
    );
    if (!contract) return sendNotFound(res, 'Contract not found');

    // ถ้าสัญญายัง active ให้ปิดสัญญาไปพร้อมกัน (admin สั่งคืนเงิน = จบสัญญา)
    if (contract.status === 'active') {
      await pool.query(`UPDATE contracts SET status = 'terminated' WHERE contract_id = ?`, [contract_id]);
      await RoomModel.updateStatus(contract.room_id, 'available');
    }

    await DepositModel.finalizeRefund(deposit.deposit_id, {
      deduction,
      deduction_note: note || null,
      refund_amount: Number(refund_amount),
      processed_by: req.user.user_id,
    });

    return sendSuccess(res, { contract_id, refund_amount, deduction }, 'คืนเงินประกันสำเร็จ');
  } catch (err) { next(err); }
};

module.exports = { getAll, refund };