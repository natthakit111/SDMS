/**
 * controllers/moveOutController.js
 */
const { validationResult } = require('express-validator');
const MoveOutModel    = require('../models/moveOut.model');
const TenantModel     = require('../models/tenant.model');
const ContractModel   = require('../models/contract.model');
const RoomModel       = require('../models/room.model');
const {
  sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendForbidden,
} = require('../utils/response');

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

    // ตรวจว่ายังไม่มี pending request
    const hasPending = await MoveOutModel.hasPendingRequest(tenant.tenant_id);
    if (hasPending)
      return sendBadRequest(res, 'คุณมีคำร้องขอย้ายออกที่รอการอนุมัติอยู่แล้ว');

    const { move_out_date, reason } = req.body;

    // 💡 ไม่บล็อกคำร้องที่แจ้งกะทันหันอีกต่อไป — ฝั่ง frontend แจ้งเตือนผู้เช่า
    // เรื่องค่าปรับไปแล้วก่อนกดส่ง ผู้เช่ายืนยันเองว่ายอมรับเงื่อนไข ส่วนแอดมิน
    // ก็เห็นทั้งวันที่ส่งคำร้องและวันที่ต้องการย้ายออกในตารางอยู่แล้ว
    // เทียบสองวันนี้เองได้ว่ากะทันหันแค่ไหน ไม่ต้องมี field เพิ่ม

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

// ── PUT /api/move-out/:id/approve  (admin only) ──────────────────────────────
const approve = async (req, res, next) => {
  try {
    const request = await MoveOutModel.findById(req.params.id);
    if (!request) return sendNotFound(res, 'ไม่พบคำร้องนี้');
    if (request.status !== 'pending') return sendBadRequest(res, 'คำร้องนี้ถูกพิจารณาไปแล้ว');

    const { admin_note } = req.body;

    // ยกเลิกสัญญาและเปิดห้องว่าง — reuse ContractModel/RoomModel แทนการ query ตรง ๆ
    await ContractModel.updateStatus(request.contract_id, 'terminated');
    await RoomModel.updateStatus(request.room_id, 'available');

    await MoveOutModel.updateReviewStatus(request.request_id, 'approved', {
      admin_note,
      reviewed_by: req.user.user_id,
    });

    return sendSuccess(res, await MoveOutModel.findById(request.request_id), 'อนุมัติคำร้องขอย้ายออกสำเร็จ');
  } catch (err) { next(err); }
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

module.exports = { getAll, create, approve, reject };