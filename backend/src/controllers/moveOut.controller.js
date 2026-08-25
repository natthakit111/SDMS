/**
 * controllers/moveOutController.js
 */
const { validationResult } = require('express-validator');
const { pool }         = require('../config/db');
const MoveOutModel     = require('../models/moveOut.model');
const TenantModel      = require('../models/tenant.model');
const ContractModel    = require('../models/contract.model');
const RoomModel        = require('../models/room.model');
const DepositModel     = require('../models/deposit.model');
const logger = require('../utils/logger');
const {
  sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendForbidden,
} = require('../utils/response');

// ── คำนวณค่าปรับ/ยอดคืนเงินประกัน (ใช้ร่วมกันทั้ง preview และ approve) ────────
// logic เดียวกับที่เคยอยู่ใน contractController.terminateContract
const calcDepositRefund = (contract, checkoutDate = new Date()) => {
  const endDate       = new Date(contract.end_date);
  const deposit        = parseFloat(contract.deposit_amount || 0);
  const rent           = parseFloat(contract.rent_amount || 0);
  const daysRemaining  = Math.ceil((endDate - checkoutDate) / (1000 * 60 * 60 * 24));
  const fine_amount    = daysRemaining > 30 ? rent : 0;
  const net_refund     = Math.max(0, deposit - fine_amount);
  return {
    deposit_amount: deposit,
    days_remaining: daysRemaining,
    fine_amount,
    fine_reason: fine_amount > 0 ? `ออกก่อนสัญญา ${daysRemaining} วัน (มีค่าปรับ 1 เดือน)` : null,
    net_refund,
  };
};

// ── GET /api/move-out  (admin: all | tenant: own) ────────────────────────────
const getAll = async (req, res, next) => {
  try {
    let tenantId = null;
    if (req.user.role === 'tenant') {
      const tenant = await TenantModel.findByUserId(req.user.user_id);
      if (!tenant) return sendNotFound(res, 'ไม่พบข้อมูลผู้เช่า');
      tenantId = tenant.tenant_id;
    }
    const rows = await MoveOutModel.findAll({ tenantId });
    return sendSuccess(res, rows);
  } catch (err) { next(err); }
};

// ── POST /api/move-out  (tenant only) ────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง', errors.array());

    const tenant = await TenantModel.findByUserId(req.user.user_id);
    if (!tenant) return sendNotFound(res, 'ไม่พบข้อมูลผู้เช่า');

    const contract = await ContractModel.findActiveByTenant(tenant.tenant_id);
    if (!contract) return sendBadRequest(res, 'คุณไม่มีสัญญาเช่าที่ใช้งานอยู่');

    const hasPending = await MoveOutModel.hasPendingRequest(tenant.tenant_id);
    if (hasPending)
      return sendBadRequest(res, 'คุณมีคำร้องขอย้ายออกที่รอการอนุมัติอยู่แล้ว');

    const { move_out_date, reason } = req.body;

    // ⚠️ FIX: เดิมเช็คแค่รูปแบบวันที่ (isDate() ใน moveOut.routes.js) ไม่เช็ค
    // ว่าอยู่ในช่วงสัญญาหรือไม่ ทำให้เลือกวันที่เกินวันสิ้นสุดสัญญาได้ ส่งผล
    // ให้พรีวิวค่าปรับ/เงินคืนโชว์ "เหลือสัญญา -N วัน" ซึ่งเป็นข้อความที่
    // เขียนไว้สำหรับกรณีใกล้หมดสัญญาปกติ ไม่ใช่กรณีเกินสัญญาไปแล้ว
    if (new Date(move_out_date) > new Date(contract.end_date)) {
      return sendBadRequest(res, 'ไม่สามารถแจ้งย้ายออกเกินวันที่สิ้นสุดสัญญาได้ กรุณาเลือกวันที่ไม่เกินวันหมดสัญญา หรือติดต่อผู้ดูแลหอพักหากต้องการต่อสัญญา');
    }

    const requestId = await MoveOutModel.create({
      tenant_id:   tenant.tenant_id,
      contract_id: contract.contract_id,
      room_id:     contract.room_id,
      move_out_date,
      reason,
    });

    const created = await MoveOutModel.findById(requestId);
    return sendCreated(res, created, 'ส่งคำร้องขอย้ายออกสำเร็จ');
  } catch (err) { next(err); }
};

// ── GET /api/move-out/:id/deposit-preview  (admin only) ──────────────────────
// พรีวิวยอดคืนเงินประกันก่อนอนุมัติ — ไม่เขียนอะไรลง DB
// ⚠️ FIX: ไม่ใช้ request.move_out_date (tenant กรอกเอง) คำนวณอีกต่อไป —
// default เป็นวันนี้ (วันที่ admin กำลังพิจารณา) รับ query param
// ?checkout_date= เผื่อ admin อยากลองคำนวณสถานการณ์อื่น (เช่นถ้าจะยืนยัน
// วันที่ตรวจห้องล่วงหน้า/ย้อนหลัง)
const getDepositPreview = async (req, res, next) => {
  try {
    const request = await MoveOutModel.findById(req.params.id);
    if (!request) return sendNotFound(res, 'ไม่พบคำร้องนี้');

    const contract = await ContractModel.findById(request.contract_id);
    if (!contract) return sendNotFound(res, 'ไม่พบสัญญาเช่าของคำร้องนี้');

    let checkoutDate = new Date();
    if (req.query.checkout_date) {
      const parsed = new Date(req.query.checkout_date);
      if (!Number.isNaN(parsed.getTime())) checkoutDate = parsed;
    }

    const preview = calcDepositRefund(contract, checkoutDate);
    return sendSuccess(res, {
      ...preview,
      checkout_date_used: checkoutDate.toISOString().split('T')[0],
      tenant_requested_date: request.move_out_date, // แสดงไว้ให้ admin ดูอ้างอิงเฉยๆ ไม่ใช้คำนวณ
    });
  } catch (err) { next(err); }
};

// ── PUT /api/move-out/:id/approve  (admin only) ──────────────────────────────
// body: { admin_note, actual_checkout_date?, deduction_extra, deduction_extra_note }
const approve = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const request = await MoveOutModel.findById(req.params.id);
    if (!request) { conn.release(); return sendNotFound(res, 'ไม่พบคำร้องนี้'); }
    if (request.status !== 'pending') {
      conn.release();
      return sendBadRequest(res, 'คำร้องนี้ถูกพิจารณาไปแล้ว');
    }

    const contract = await ContractModel.findById(request.contract_id);
    if (!contract) { conn.release(); return sendNotFound(res, 'ไม่พบสัญญาเช่าของคำร้องนี้'); }

    const { admin_note, deduction_extra, deduction_extra_note, actual_checkout_date } = req.body;
    const extraDeduction = parseFloat(deduction_extra) || 0;
    if (extraDeduction < 0) {
      conn.release();
      return sendBadRequest(res, 'ยอดหักเพิ่มเติมต้องไม่ติดลบ');
    }

    // ⚠️ FIX: ตัดการพึ่ง request.move_out_date (tenant กรอกเอง) ในการ
    // คำนวณค่าปรับทั้งหมด — ใช้วันที่ admin ยืนยันจริง (actual_checkout_date)
    // ถ้าส่งมา ไม่งั้น fallback เป็นวันนี้ (วันที่ approve จริง)
    let checkoutDate = new Date();
    if (actual_checkout_date) {
      const parsed = new Date(actual_checkout_date);
      if (Number.isNaN(parsed.getTime())) {
        conn.release();
        return sendBadRequest(res, 'วันที่ย้ายออกจริงไม่ถูกต้อง');
      }
      checkoutDate = parsed;
    }

    const calc = calcDepositRefund(contract, checkoutDate);

    if (extraDeduction > calc.net_refund) {
      conn.release();
      return sendBadRequest(res, 'ยอดหักเพิ่มเติมเกินกว่ายอดเงินประกันที่เหลืออยู่');
    }

    const totalDeduction = calc.fine_amount + extraDeduction;
    const finalRefund    = Math.max(0, calc.deposit_amount - totalDeduction);

    await conn.beginTransaction();

    await ContractModel.updateStatus(request.contract_id, 'terminated', conn);
    await RoomModel.updateStatus(request.room_id, 'available', conn);

    if (calc.deposit_amount > 0) {
      const deposit = await DepositModel.findByContract(request.contract_id);
      if (deposit) {
        const noteParts = [];
        if (calc.fine_reason) noteParts.push(calc.fine_reason);
        if (extraDeduction > 0) noteParts.push(deduction_extra_note || `หักเพิ่มเติม ${extraDeduction} บาท`);

        await DepositModel.finalizeRefund(deposit.deposit_id, {
          deduction: totalDeduction,
          deduction_note: noteParts.join(' | ') || null,
          refund_amount: finalRefund,
          processed_by: req.user.user_id,
          move_out_request_id: request.request_id,
        }, conn);
      } else {
        logger.warn(`Move-out approve: contract ${request.contract_id} has deposit_amount=${calc.deposit_amount} but no deposits record found (request_id=${request.request_id})`);
      }
    }

    await MoveOutModel.updateReviewStatus(request.request_id, 'approved', {
      admin_note,
      reviewed_by: req.user.user_id,
      actual_move_out_date: checkoutDate.toISOString().split('T')[0], // ⚠️ audit trail
    }, conn);

    await conn.commit();

    return sendSuccess(res, {
      ...(await MoveOutModel.findById(request.request_id)),
      deposit_summary: {
        deposit_amount: calc.deposit_amount,
        checkout_date_used: checkoutDate.toISOString().split('T')[0],
        fine_amount: calc.fine_amount,
        deduction_extra: extraDeduction,
        total_deduction: totalDeduction,
        refund_amount: finalRefund,
      },
    }, 'อนุมัติคำร้องขอย้ายออกสำเร็จ');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ── PUT /api/move-out/:id/reject  (admin only) ───────────────────────────────
const reject = async (req, res, next) => {
  try {
    const request = await MoveOutModel.findById(req.params.id);
    if (!request) return sendNotFound(res, 'ไม่พบคำร้องนี้');
    if (request.status !== 'pending') return sendBadRequest(res, 'คำร้องนี้ถูกพิจารณาไปแล้ว');

    const { admin_note } = req.body;
    await MoveOutModel.updateReviewStatus(request.request_id, 'rejected', {
      admin_note,
      reviewed_by: req.user.user_id,
    });

    return sendSuccess(res, await MoveOutModel.findById(request.request_id), 'ปฏิเสธคำร้องขอย้ายออกแล้ว');
  } catch (err) { next(err); }
};

module.exports = { getAll, create, getDepositPreview, approve, reject };