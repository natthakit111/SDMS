/**
 * controllers/paymentController.js (Phase 5 — เชื่อมต่อ Telegram แล้ว)
 */

const { validationResult } = require('express-validator');
const { pool }        = require('../config/db');
const PaymentModel    = require('../models/payment.model');
const BillModel       = require('../models/bill.model');
const TenantModel     = require('../models/tenant.model');
const TelegramService = require('../services/telegram.service');
const { sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendForbidden } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const getAllPayments = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const { tenant_id, bill_id, status, payment_method, search, month, year } = req.query;
    const { page, limit, offset, isPaginated } = parsePagination(req.query);
    const filters = {
      tenant_id, bill_id, status, payment_method, search: search || null,
      month: month ? Number(month) : null, year: year ? Number(year) : null,
    };

    const payments = await PaymentModel.findAll({ ...filters, limit, offset });
    if (!isPaginated) return sendSuccess(res, payments);

    const [total, statusCounts, revenue] = await Promise.all([
      PaymentModel.countAll(filters),
      PaymentModel.countByStatus(filters),
      PaymentModel.sumAmount(filters),
    ]);
    return sendSuccess(res, {
      items: payments,
      pagination: buildPaginationMeta(page, limit, total),
      statusCounts,
      revenue,
    });
  } catch (err) { next(err); }
};

const getMyPayments = async (req, res, next) => {
  try {
    const tenant = await TenantModel.findByUserId(req.user.user_id);
    if (!tenant) return sendNotFound(res, 'ไม่พบข้อมูลโปรไฟล์ผู้เช่า');
    const payments = await PaymentModel.findAll({ tenant_id: tenant.tenant_id });
    return sendSuccess(res, payments);
  } catch (err) { next(err); }
};

const getPaymentById = async (req, res, next) => {
  try {
    const payment = await PaymentModel.findById(req.params.id);
    if (!payment) return sendNotFound(res, 'ไม่พบข้อมูลการชำระเงิน');
    if (req.user.role === 'tenant') {
      const tenant = await TenantModel.findByUserId(req.user.user_id);
      if (!tenant || tenant.tenant_id !== payment.tenant_id) return sendForbidden(res, 'ไม่มีสิทธิ์เข้าถึงข้อมูล');
    }
    return sendSuccess(res, payment);
  } catch (err) { next(err); }
};

// helper: ส่ง error พร้อม error_code ให้ frontend แปลได้
const sendErrorWithCode = (res, statusCode, error_code, message) => {
  return res.status(statusCode).json({ success: false, error_code, message });
};

const submitPayment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const { bill_id, payment_method } = req.body;

    const tenant = await TenantModel.findByUserId(req.user.user_id);
    if (!tenant) return sendNotFound(res, 'ไม่พบข้อมูลโปรไฟล์ผู้เช่า');

    const bill = await BillModel.findById(bill_id);
    // ⚠️ FIX: เช็ค ownership ก่อนเปิดเผยสถานะบิล — เดิมเช็คสถานะ (paid/
    // cancelled) ก่อนเช็คว่าเป็นเจ้าของไหม ทำให้ tenant คนไหนก็ตามส่ง
    // bill_id ของคนอื่นมาเดา (auto-increment ID เดาง่าย) แล้วรู้สถานะ
    // การเงินของ tenant คนอื่นได้ทันที ทั้งที่ไม่ใช่บิลของตัวเอง — ตอนนี้
    // เช็ค ownership ก่อน และคืน 404 เหมือนไม่มีบิลนี้อยู่เลย ไม่ยืนยัน
    // ด้วยซ้ำว่า bill_id นี้มีอยู่จริงในระบบ
    
    // controllers/paymentController.js
    if (!bill || bill.tenant_id !== tenant.tenant_id) {
      return sendErrorWithCode(res, 404, 'payment.error.billNotFound', 'ไม่พบข้อมูลบิล');
    }

    if (bill.status === 'paid') return sendErrorWithCode(res, 400, 'payment.error.alreadyPaid', 'บิลนี้ชำระเงินแล้ว');
    if (bill.status === 'cancelled') return sendErrorWithCode(res, 400, 'payment.error.cancelled', 'บิลนี้ถูกยกเลิกแล้ว');

    const existingPayments = await PaymentModel.findByBillId(bill_id);
    const hasPending = existingPayments.some(p => p.status === 'pending_verify');
    if (hasPending)
      return sendErrorWithCode(res, 400, 'payment.error.pendingVerify', 'มีรายการชำระเงินที่รอการตรวจสอบอยู่แล้ว');

    const slip_image = req.file ? req.file.path : null;
    const method = payment_method || 'qr_promptpay';

    // ⚠️ FIX: frontend เช็คแล้วว่าต้องแนบสลิปยกเว้นจ่ายเงินสด (ไม่มีสลิปให้แนบ
    // จริงๆ) แต่เดิม backend ไม่เช็คซ้ำ — ยิง API ตรงๆ ข้าม UI จะแจ้งชำระเงิน
    // qr_promptpay/bank_transfer โดยไม่มีหลักฐานเลยก็ได้
    if (method !== 'cash' && !slip_image) {
      return sendErrorWithCode(res, 400, 'payment.error.slipRequired', 'กรุณาแนบรูปสลิปการโอนเงิน');
    }

    const paymentId = await PaymentModel.create({
      bill_id: parseInt(bill_id), tenant_id: tenant.tenant_id,
      amount_paid: bill.total_amount, payment_method: method, slip_image,
    });

    const newPayment = await PaymentModel.findById(paymentId);
    TelegramService.notifyAdminNewPayment(newPayment).catch(() => {});

    return sendCreated(res, newPayment, 'ส่งข้อมูลการชำระเงินสำเร็จ กำลังรอผู้ดูแลระบบตรวจสอบ');
  } catch (err) { next(err); }
};

const verifyPayment = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const payment = await PaymentModel.findById(req.params.id);
    if (!payment) { conn.release(); return sendNotFound(res, 'ไม่พบข้อมูลการชำระเงิน'); }
    if (payment.status !== 'pending_verify') {
      conn.release();
      return sendBadRequest(res, `รายการชำระเงินนี้มีสถานะ '${payment.status}' อยู่แล้ว`);
    }

    await conn.beginTransaction();

    // guard บน UPDATE เช็คสถานะซ้ำ + affectedRows กันสองแอดมินกดยืนยัน/ปฏิเสธพร้อมกัน
    const affected = await PaymentModel.verify(req.params.id, req.user.user_id, 'verified', req.body.remark || null, conn);
    if (affected === 0) {
      await conn.rollback();
      conn.release();
      return sendBadRequest(res, 'รายการชำระเงินนี้ถูกดำเนินการไปแล้วโดยผู้ดูแลระบบคนอื่น กรุณารีเฟรชหน้าจอ');
    }
    await BillModel.updateStatus(payment.bill_id, 'paid', conn);

    await conn.commit();

    const updated = await PaymentModel.findById(req.params.id);
    TelegramService.sendPaymentConfirmation(updated).catch(() => {});

    return sendSuccess(res, updated, 'ยืนยันการชำระเงินสำเร็จ — บิลถูกเปลี่ยนสถานะเป็นชำระแล้ว');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

const rejectPayment = async (req, res, next) => {
  try {
    const { remark } = req.body;
    if (!remark) return sendBadRequest(res, 'กรุณาระบุหมายเหตุหรือเหตุผลในการปฏิเสธการชำระเงิน');

    const payment = await PaymentModel.findById(req.params.id);
    if (!payment) return sendNotFound(res, 'ไม่พบข้อมูลการชำระเงิน');
    if (payment.status !== 'pending_verify') return sendBadRequest(res, `รายการชำระเงินนี้มีสถานะ '${payment.status}' อยู่แล้ว`);

    // guard บน UPDATE เช็คสถานะซ้ำ + affectedRows กันสองแอดมินกดยืนยัน/ปฏิเสธพร้อมกัน
    const affected = await PaymentModel.verify(req.params.id, req.user.user_id, 'rejected', remark);
    if (affected === 0) {
      return sendBadRequest(res, 'รายการชำระเงินนี้ถูกดำเนินการไปแล้วโดยผู้ดูแลระบบคนอื่น กรุณารีเฟรชหน้าจอ');
    }
    const updated = await PaymentModel.findById(req.params.id);
    TelegramService.sendPaymentRejected(updated).catch(() => {});

    return sendSuccess(res, updated, 'ปฏิเสธการชำระเงินแล้ว ผู้เช่าจะได้รับการแจ้งเตือน');
  } catch (err) { next(err); }
};

module.exports = { getAllPayments, getMyPayments, getPaymentById, submitPayment, verifyPayment, rejectPayment };