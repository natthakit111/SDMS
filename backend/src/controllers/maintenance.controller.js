/**
 * controllers/maintenanceController.js (Phase 5 — เชื่อมต่อ Telegram แล้ว)
 * เวอร์ชันภาษาไทย — แปลเฉพาะคอมเมนต์และข้อความที่ผู้ใช้เห็น (error/success message)
 * ชื่อฟังก์ชัน ตัวแปร และ module.exports ยังคงเดิมทุกจุด เพื่อไม่ให้ไฟล์อื่น
 * ที่ import เข้ามา (routes, tests ฯลฯ) พัง
 */

const { validationResult } = require('express-validator');
const MaintenanceModel = require('../models/maintenance.model');
const TenantModel      = require('../models/tenant.model');
const ContractModel    = require('../models/contract.model');
const TelegramService  = require('../services/telegram.service');
const { sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendForbidden } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

// ── ดึงคำร้องแจ้งซ่อมทั้งหมด (แอดมิน) พร้อม filter ตาม status/priority/room/tenant ──
const getAllRequests = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const { status, priority, room_id, tenant_id } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    const [requests, total] = await Promise.all([
      MaintenanceModel.findAll({ status, priority, room_id, tenant_id, limit, offset }),
      MaintenanceModel.countAll({ status, priority, room_id, tenant_id }),
    ]);

    return sendSuccess(res, { items: requests, pagination: buildPaginationMeta(page, limit, total) });
  } catch (err) { next(err); }
};

// ── สรุปจำนวนคำร้องแยกตามสถานะ สำหรับหน้า dashboard แอดมิน ──
const getStats = async (req, res, next) => {
  try {
    const stats = await MaintenanceModel.getStatusSummary();
    return sendSuccess(res, stats);
  } catch (err) { next(err); }
};

// ── ดึงคำร้องแจ้งซ่อมของผู้เช่าที่ล็อกอินอยู่ ──
const getMyRequests = async (req, res, next) => {
  try {
    const tenant = await TenantModel.findByUserId(req.user.user_id);
    if (!tenant) return sendNotFound(res, 'ไม่พบข้อมูลผู้เช่า');
    const requests = await MaintenanceModel.findByTenantId(tenant.tenant_id);
    return sendSuccess(res, requests);
  } catch (err) { next(err); }
};

// ── ดึงคำร้องแจ้งซ่อมตาม id เดียว พร้อมเช็คสิทธิ์ว่าผู้เช่าดูได้แค่คำร้องของตัวเอง ──
const getRequestById = async (req, res, next) => {
  try {
    const request = await MaintenanceModel.findById(req.params.id);
    if (!request) return sendNotFound(res, 'ไม่พบคำร้องแจ้งซ่อม');
    if (req.user.role === 'tenant') {
      const tenant = await TenantModel.findByUserId(req.user.user_id);
      if (!tenant || tenant.tenant_id !== request.tenant_id) return sendForbidden(res, 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้');
    }
    return sendSuccess(res, request);
  } catch (err) { next(err); }
};

// ── ผู้เช่าสร้างคำร้องแจ้งซ่อมใหม่ + แจ้งเตือนแอดมินผ่าน Telegram ──
const createRequest = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const tenant = await TenantModel.findByUserId(req.user.user_id);
    if (!tenant) return sendNotFound(res, 'ไม่พบข้อมูลผู้เช่า');

    const contract = await ContractModel.findActiveByTenant(tenant.tenant_id);
    if (!contract) return sendBadRequest(res, 'คุณไม่มีสัญญาเช่าที่ยังใช้งานอยู่ ไม่สามารถส่งคำร้องได้');

    const { category, description, priority } = req.body;
    const image_path = req.file ? req.file.path.replace(/\\/g, '/') : null;

    const requestId = await MaintenanceModel.create({
      tenant_id: tenant.tenant_id, room_id: contract.room_id,
      category, description, image_path, priority: priority || 'medium',
    });

    const newRequest = await MaintenanceModel.findById(requestId);

    // ✅ Phase 5: แจ้งเตือนแอดมินผ่าน Telegram
    TelegramService.notifyAdminNewMaintenance(newRequest).catch(() => {});

    return sendCreated(res, newRequest, 'ส่งคำร้องแจ้งซ่อมสำเร็จ');
  } catch (err) { next(err); }
};

// ใหม่ — validator ที่ route จัดการเรื่อง status/admin_note/assigned_to format ไปแล้ว
// controller เหลือแค่ business logic (เช็คว่า request มีอยู่จริง + status ปัจจุบันแก้ได้ไหม)
const updateStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const { status, admin_note, assigned_to } = req.body;

    const request = await MaintenanceModel.findById(req.params.id);
    if (!request) return sendNotFound(res, 'ไม่พบคำร้องแจ้งซ่อม');
    if (request.status === 'resolved' || request.status === 'cancelled') {
      return sendBadRequest(res, `ไม่สามารถแก้ไขคำร้องที่มีสถานะ '${request.status}' ได้`);
    }

    await MaintenanceModel.updateStatus(req.params.id, status, admin_note || null, assigned_to || null);
    const updated = await MaintenanceModel.findById(req.params.id);

    TelegramService.sendMaintenanceUpdate(updated).catch(() => {});

    return sendSuccess(res, updated, `อัปเดตสถานะคำร้องเป็น '${status}' สำเร็จ`);
  } catch (err) { next(err); }
};

// ── ผู้เช่ายกเลิกคำร้องของตัวเอง (ยกเลิกได้เฉพาะสถานะ pending เท่านั้น) ──
const cancelRequest = async (req, res, next) => {
  try {
    const request = await MaintenanceModel.findById(req.params.id);
    if (!request) return sendNotFound(res, 'ไม่พบคำร้องแจ้งซ่อม');

    const tenant = await TenantModel.findByUserId(req.user.user_id);
    if (!tenant || tenant.tenant_id !== request.tenant_id) return sendForbidden(res, 'คุณสามารถยกเลิกได้เฉพาะคำร้องของตัวเองเท่านั้น');
    if (request.status !== 'pending') return sendBadRequest(res, `ไม่สามารถยกเลิกคำร้องที่มีสถานะ '${request.status}' อยู่แล้วได้`);

    await MaintenanceModel.updateStatus(req.params.id, 'cancelled', 'ยกเลิกโดยผู้เช่า');
    return sendSuccess(res, null, 'ยกเลิกคำร้องแจ้งซ่อมเรียบร้อยแล้ว');
  } catch (err) { next(err); }
};

module.exports = { getAllRequests, getStats, getMyRequests, getRequestById, createRequest, updateStatus, cancelRequest };