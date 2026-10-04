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

const DAY_MS      = 1000 * 60 * 60 * 24;
const NOTICE_DAYS = 30; // ต้องแจ้งล่วงหน้าอย่างน้อยกี่วัน (นับจากวันแจ้ง ถึงวันย้ายออกจริง)

// ── วันที่ตามปฏิทินเวลาไทย (UTC+7) ───────────────────────────────────────────
// db.js ตั้ง timezone '+07:00' ทำให้คอลัมน์ DATE กลายเป็น Date ที่ตรงกับเที่ยงคืน
// เวลาไทย (เช่น 2098-01-14T17:00:00Z) ถ้าอ่านด้วย getDate() ตาม timezone เครื่อง
// (เช่น server เป็น UTC) จะได้วันก่อนหน้า 1 วัน จึงต้องคำนวณตามเวลาไทยเสมอ
// คืนค่าเป็น Date ที่ตรงกับ 00:00 UTC ของ "วันที่ไทย" นั้น (ใช้เทียบ/ลบกันได้)
const TH_OFFSET_MS = 7 * 60 * 60 * 1000;

const startOfDay = (d) => {
  // สตริง 'YYYY-MM-DD' ล้วนๆ = วันที่ตามปฏิทินอยู่แล้ว
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, day));
  }
  const t = new Date(new Date(d).getTime() + TH_OFFSET_MS);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
};
const diffDays = (later, earlier) =>
  Math.round((startOfDay(later) - startOfDay(earlier)) / DAY_MS);

const toDateString = (d) => {
  const x = startOfDay(d);
  const mm = String(x.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(x.getUTCDate()).padStart(2, '0');
  return `${x.getUTCFullYear()}-${mm}-${dd}`;
};

// ── คำนวณค่าปรับ/ยอดคืนเงินประกัน (ใช้ร่วมกันทั้ง preview และ approve) ────────
// กฎ: ค่าปรับ 1 เดือนเมื่อ "แจ้งล่วงหน้าไม่ครบ 30 วัน" โดยนับจากวันที่แจ้ง
// (noticeDate = created_at ของคำร้อง) ถึงวันย้ายออกจริง (moveOutDate)
// ไม่เกี่ยวกับว่าย้ายออกก่อนวันสิ้นสุดสัญญากี่วัน — แจ้งเดือน ต.ค. ขอออกสิ้น ธ.ค.
// ถือว่าถูกต้อง ไม่โดนปรับ
// ⚠️ ถ้าสัญญาของหอมีเงื่อนไข "ออกก่อนสิ้นสุดสัญญา" แยกอีกข้อ ให้เพิ่มที่ marker ด้านล่าง
const calcDepositRefund = (contract, { noticeDate, moveOutDate }) => {
  const deposit = parseFloat(contract.deposit_amount || 0);
  const rent    = parseFloat(contract.rent_amount || 0);

  const noticeDaysGiven = diffDays(moveOutDate, noticeDate);
  const daysRemaining   = diffDays(contract.end_date, moveOutDate); // ข้อมูลอ้างอิง

  const reasons = [];
  let fine_amount = 0;

  if (noticeDaysGiven < NOTICE_DAYS) {
    fine_amount = rent;
    reasons.push(
      `แจ้งย้ายออกล่วงหน้า ${Math.max(0, noticeDaysGiven)} วัน (ไม่ครบ ${NOTICE_DAYS} วัน) มีค่าปรับ 1 เดือน`
    );
  }
  // TODO(ตามสัญญาหอ): กฎ "ออกก่อนสิ้นสุดสัญญา" เพิ่มตรงนี้ถ้ามี

  fine_amount = Math.min(fine_amount, deposit);

  return {
    deposit_amount: deposit,
    notice_days_given: noticeDaysGiven,
    days_remaining: daysRemaining,
    fine_amount,
    fine_reason: reasons.length ? reasons.join(' | ') : null,
    net_refund: Math.max(0, deposit - fine_amount),
  };
};

// แปลง ?checkout_date= / actual_checkout_date เป็น Date
// คืน null ถ้าไม่ส่งมา, คืน 'invalid' ถ้ารูปแบบผิด
const parseCheckoutDate = (raw) => {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? 'invalid' : parsed;
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

    // ห้ามแจ้งย้ายออกเกินวันสิ้นสุดสัญญา
    if (new Date(move_out_date) > new Date(contract.end_date)) {
      return sendBadRequest(res, 'ไม่สามารถแจ้งย้ายออกเกินวันที่สิ้นสุดสัญญาได้ กรุณาเลือกวันที่ไม่เกินวันหมดสัญญา หรือติดต่อผู้ดูแลหอพักหากต้องการต่อสัญญา');
    }

    // ห้ามเลือกวันย้ายออกที่ผ่านมาแล้ว
    if (diffDays(move_out_date, new Date()) < 0) {
      return sendBadRequest(res, 'ไม่สามารถเลือกวันย้ายออกย้อนหลังได้');
    }

    // ไม่บล็อก แต่แจ้งเตือนผู้เช่าว่าจะมีค่าปรับถ้าแจ้งไม่ครบ 30 วัน
    const noticeDaysGiven = diffDays(move_out_date, new Date());
    const finePossible = noticeDaysGiven < NOTICE_DAYS;

    const requestId = await MoveOutModel.create({
      tenant_id:   tenant.tenant_id,
      contract_id: contract.contract_id,
      room_id:     contract.room_id,
      move_out_date,
      reason,
    });

    const created = await MoveOutModel.findById(requestId);
    return sendCreated(
      res,
      { ...created, notice_days_given: noticeDaysGiven, fine_possible: finePossible },
      finePossible
        ? `ส่งคำร้องขอย้ายออกสำเร็จ (แจ้งล่วงหน้าไม่ครบ ${NOTICE_DAYS} วัน อาจมีค่าปรับ 1 เดือนตามสัญญา)`
        : 'ส่งคำร้องขอย้ายออกสำเร็จ'
    );
  } catch (err) { next(err); }
};

// ── GET /api/move-out/:id/deposit-preview  (admin only) ──────────────────────
// พรีวิวยอดคืนเงินประกันก่อนอนุมัติ — ไม่เขียนอะไรลง DB
// default วันย้ายออก = move_out_date ที่ผู้เช่าขอ (แอดมินแก้เป็นวันจริงได้ผ่าน
// ?checkout_date=) ส่วนวันแจ้ง = created_at ของคำร้อง
const getDepositPreview = async (req, res, next) => {
  try {
    const request = await MoveOutModel.findById(req.params.id);
    if (!request) return sendNotFound(res, 'ไม่พบคำร้องนี้');

    const contract = await ContractModel.findById(request.contract_id);
    if (!contract) return sendNotFound(res, 'ไม่พบสัญญาเช่าของคำร้องนี้');

    const parsed = parseCheckoutDate(req.query.checkout_date);
    if (parsed === 'invalid') return sendBadRequest(res, 'วันที่ย้ายออกไม่ถูกต้อง');
    const moveOutDate = parsed ?? new Date(request.move_out_date);

    const preview = calcDepositRefund(contract, {
      noticeDate: new Date(request.created_at),
      moveOutDate,
    });
    return sendSuccess(res, {
      ...preview,
      checkout_date_used: toDateString(moveOutDate),
      tenant_requested_date: request.move_out_date,
      notice_date: toDateString(request.created_at),
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

    // วันย้ายออกจริง: ใช้ที่ admin ยืนยัน ถ้าไม่ส่งมา fallback เป็นวันที่ผู้เช่าขอ
    const parsed = parseCheckoutDate(actual_checkout_date);
    if (parsed === 'invalid') {
      conn.release();
      return sendBadRequest(res, 'วันที่ย้ายออกจริงไม่ถูกต้อง');
    }
    const checkoutDate = parsed ?? new Date(request.move_out_date);

    const calc = calcDepositRefund(contract, {
      noticeDate: new Date(request.created_at),
      moveOutDate: checkoutDate,
    });

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
      actual_move_out_date: toDateString(checkoutDate), // audit trail
    }, conn);

    await conn.commit();

    return sendSuccess(res, {
      ...(await MoveOutModel.findById(request.request_id)),
      deposit_summary: {
        deposit_amount: calc.deposit_amount,
        checkout_date_used: toDateString(checkoutDate),
        notice_days_given: calc.notice_days_given,
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

module.exports = { getAll, create, getDepositPreview, approve, reject, calcDepositRefund };