/**
 * controllers/billController.js (Phase 5 — Telegram wired in + PDF invoice export)
 *
 * PDF invoice export ใช้ Puppeteer (HTML/CSS → PDF) แทน pdfkit
 * ดู services/pdf.service.js (browser singleton) และ services/invoiceTemplate.js (เทมเพลต HTML)
 */

const { validationResult } = require('express-validator');
const QRCode              = require('qrcode');
const BillModel           = require('../models/bill.model');
const ContractModel       = require('../models/contract.model');
const { calculateBill, getDefaultDueDate, getSetting } = require('../services/bill.service');
const { generatePromptPayQR } = require('../services/qr.service');
const TelegramService     = require('../services/telegram.service');
const TenantModel         = require('../models/tenant.model');
const { htmlToPdfBuffer } = require('../services/pdf.service');
const { renderInvoiceHtml } = require('../services/invoiceTemplate');
const { sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendError } = require('../utils/response');
const SettingsModel = require('../models/settings.model');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const getAllBills = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const { room_id, status, month, year, tenant_id, search } = req.query;
    const { page, limit, offset, isPaginated } = parsePagination(req.query);
    const filters = { room_id, status, month, year, tenant_id, search: search || null };

    const bills = await BillModel.findAll({ ...filters, limit, offset });
    if (!isPaginated) return sendSuccess(res, bills);

    const total = await BillModel.countAll(filters);
    return sendSuccess(res, { items: bills, pagination: buildPaginationMeta(page, limit, total) });
  } catch (err) { next(err); }
};

const getMyBills = async (req, res, next) => {
  try {
    const tenant = await TenantModel.findByUserId(req.user.user_id);
    if (!tenant) return sendNotFound(res, 'Tenant profile not found');
    const bills = await BillModel.findByTenantId(tenant.tenant_id);
    return sendSuccess(res, bills);
  } catch (err) { next(err); }
};

const getBillById = async (req, res, next) => {
  try {
    const bill = await BillModel.findByIdWithMeters(req.params.id)
    if (!bill) return sendNotFound(res, 'Bill not found');
    if (req.user.role === 'tenant') {
      const tenant = await TenantModel.findByUserId(req.user.user_id);
      if (!tenant || tenant.tenant_id !== bill.tenant_id) return sendNotFound(res, 'Bill not found');
    }
    return sendSuccess(res, bill);
  } catch (err) { next(err); }
};

const getBillQR = async (req, res, next) => {
  try {
    const bill = await BillModel.findById(req.params.id);
    if (!bill) return sendNotFound(res, 'Bill not found');

    // ⚠️ FIX: เดิมไม่มี ownership check — tenant คนไหนก็เรียกดู QR/เลขบัญชี
    // ของบิลห้องอื่นได้ถ้ารู้ bill_id (IDOR)
    if (req.user.role === 'tenant') {
      const tenant = await TenantModel.findByUserId(req.user.user_id);
      if (!tenant || tenant.tenant_id !== bill.tenant_id) return sendNotFound(res, 'Bill not found');
    }

    if (bill.status === 'paid')      return sendBadRequest(res, 'This bill has already been paid');
    if (bill.status === 'cancelled') return sendBadRequest(res, 'This bill is cancelled');

    let qrPayload = bill.qr_payload;
    if (!qrPayload) {
      // FIX: อ่านจาก dorm_settings แทน process.env — ให้ตรงกับ generateBill
      // (เดิม fallback ไป env var ทำให้บิลเก่าพังถ้า admin ตั้งค่าผ่าน UI อย่างเดียว)
      const promptPayId = await getSetting('promptpay_id');
      if (!promptPayId) return sendError(res, 'PromptPay ID not configured');
      qrPayload = generatePromptPayQR(promptPayId, bill.total_amount, bill.bill_id);
      await BillModel.updateQrPayload(bill.bill_id, qrPayload);
    }

    // ข้อมูลธนาคาร — โชว์ใต้ QR สำหรับผู้เช่าที่โอนผ่านแอปธนาคารแทนสแกน
    const bankInfo = await SettingsModel.getByKeys([
      'bank_name', 'bank_account', 'bank_account_name',
    ]);

    return sendSuccess(res, {
      bill_id: bill.bill_id, room_number: bill.room_number,
      tenant_name: bill.tenant_name, total_amount: bill.total_amount,
      due_date: bill.due_date, qr_payload: qrPayload,
      bank_name: bankInfo.bank_name || null,
      bank_account: bankInfo.bank_account || null,
      bank_account_name: bankInfo.bank_account_name || null,
    });
  } catch (err) { next(err); }
};

// แปลง error จาก bill.service → error_code ที่ frontend ใช้ t() แปลได้
function getBillErrorCode(message) {
  if (!message) return null;
  if (message.includes('Electric meter reading not found')) return 'bills.error.noElectricMeter';
  if (message.includes('Water meter reading not found'))    return 'bills.error.noWaterMeter';
  return null;
}

const generateBill = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'Validation failed', errors.array());

    const { room_id, month, year, other_amount = 0, note, due_date: customDueDate } = req.body;

    const existingBill = await BillModel.findByRoomMonthYear(room_id, month, year);
    if (existingBill) {
      return res.status(400).json({ success: false, error_code: 'bills.error.alreadyExists', message: 'Bill already exists' });
    }

    const contract = await ContractModel.findActiveByRoom(room_id);
    if (!contract) {
      return res.status(400).json({ success: false, error_code: 'bills.error.noContract', message: 'No active contract' });
    }

    let amounts;
    try {
      amounts = await calculateBill(room_id, month, year, parseFloat(contract.rent_amount), parseFloat(other_amount));
    } catch (calcErr) {
      const error_code = getBillErrorCode(calcErr.message);
      return res.status(400).json({ success: false, error_code, message: calcErr.message });
    }

    const due_date = customDueDate || getDefaultDueDate(parseInt(month), parseInt(year));
    const promptPayId = await getSetting('promptpay_id');
    let qrPayload = null;
    if (promptPayId) {
      try {
        qrPayload = generatePromptPayQR(promptPayId, amounts.total_amount);
      } catch (qrErr) {
        // ไม่ throw ต่อ — บิลยังสร้างได้แม้ QR พัง (เช่น promptpay_id
        // format ผิดที่หลุดผ่าน validation มาได้) แต่ log ไว้เพื่อตรวจสอบ
        console.error('[Bill] Failed to generate PromptPay QR:', qrErr.message);
      }
    } else {
      console.warn('[Bill] promptpay_id not configured in dorm_settings — bill created without QR');
    }

    // ⚠️ FIX: มี pre-check findByRoomMonthYear ด้านบนแล้ว แต่ยังมี race condition
    // ได้ (2 request มาพร้อมกันผ่าน pre-check ทั้งคู่) — ตอน INSERT ชนกับ
    // uq_bill_room_month_active ของจริงจะโยน ER_DUP_ENTRY ดิบไป errorHandler
    // กลาง ซึ่งไม่มี error_code ให้ frontend แปลภาษาได้ (ต่างจาก error_code
    // อื่นๆ ทั้งหมดในไฟล์นี้) จับตรงนี้แล้วตอบด้วย error_code เดียวกับ pre-check
    let billId;
    try {
      billId = await BillModel.create({
        contract_id: contract.contract_id, room_id: parseInt(room_id),
        bill_month: parseInt(month), bill_year: parseInt(year),
        rent_amount: amounts.rent_amount, electric_amount: amounts.electric_amount,
        water_amount: amounts.water_amount, other_amount: amounts.other_amount,
        total_amount: amounts.total_amount, due_date, note, qr_payload: qrPayload,
      });
    } catch (dbErr) {
      if (dbErr.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, error_code: 'bills.error.alreadyExists', message: 'Bill already exists' });
      }
      throw dbErr;
    }

    const newBill = await BillModel.findById(billId);
    TelegramService.sendBillNotification(newBill).catch(() => {});

    return sendCreated(res, {
      ...newBill,
      breakdown: {
        electric_units: amounts.electric_units, water_units: amounts.water_units,
        electric_rate: amounts.electric_rate,   water_rate:  amounts.water_rate,
      },
    }, 'Bill generated successfully');
  } catch (err) { next(err); }
};

const cancelBill = async (req, res, next) => {
  try {
    const bill = await BillModel.findById(req.params.id);
    if (!bill) return sendNotFound(res, 'Bill not found');
    if (bill.status === 'paid') return sendBadRequest(res, 'Cannot cancel a paid bill');
    await BillModel.updateStatus(req.params.id, 'cancelled');
    return sendSuccess(res, null, 'Bill cancelled successfully');
  } catch (err) { next(err); }
};

const getMonthlyReport = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const data = await BillModel.getMonthlyRevenue(year);
    return sendSuccess(res, { year, monthly_data: data });
  } catch (err) { next(err); }
};

// ── ข้อมูลบริษัทสำหรับใบแจ้งหนี้ ─────────────────────────────
// FIX: เดิมเป็น hardcoded constant อ่านจาก process.env.COMPANY_* ที่ค่า
// build-time เท่านั้น — แก้จากหน้า Settings แล้วไม่มีผลกับ PDF ที่ export
// ออกมาจริง (ต้องแก้ .env + restart server) ตอนนี้ดึงจาก dorm_settings
// สดๆ ทุกครั้งที่ export แทน ให้ตรงกับพฤติกรรมของ getBillQR/calculateBill
// ที่แก้ไปแล้วก่อนหน้า ค่า fallback ด้านล่างใช้เฉพาะตอนแอดมินยังไม่ได้
// กรอกอะไรเลยในหน้า Settings เท่านั้น
const getCompanyInfo = async () => {
  const s = await SettingsModel.getByKeys([
    'dorm_name', 'dorm_address', 'company_tax_id', 'admin_phone', 'admin_email',
    'bank_name', 'bank_account', 'bank_account_name', 'promptpay_id',
  ]);

  return {
    name: s.dorm_name || 'Smart Dormitory',
    sub: 'Smart Dormitory Management System',
    address: s.dorm_address || null,
    taxId: s.company_tax_id || null,
    phone: s.admin_phone || null,
    email: s.admin_email || null,
    bankName: s.bank_name || null,
    bankAccountNumber: s.bank_account || null,
    bankAccountName: s.bank_account_name || null,
    promptpayId: s.promptpay_id || null,
  };
};

// ── Export single bill as PDF invoice (HTML/CSS → Puppeteer, โทนขาว-ฟ้า) ──
const exportBillInvoice = async (req, res, next) => {
  try {
    const bill = await BillModel.findByIdWithMeters(req.params.id);
    if (!bill) return sendNotFound(res, 'Bill not found');

    if (req.user.role === 'tenant') {
      const tenant = await TenantModel.findByUserId(req.user.user_id);
      if (!tenant || tenant.tenant_id !== bill.tenant_id) return sendNotFound(res, 'Bill not found');
    }

    let qrDataUrl = null;
    if (bill.qr_payload) {
      try {
        qrDataUrl = await QRCode.toDataURL(bill.qr_payload, { margin: 1, width: 240 });
      } catch (_) { /* ข้าม QR ถ้าสร้างรูปไม่สำเร็จ */ }
    }

    const company = await getCompanyInfo();

    const html = renderInvoiceHtml({ bill, qrDataUrl, company });
    const pdfBuffer = await htmlToPdfBuffer(html);
    const buffer = Buffer.from(pdfBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${bill.bill_id}.pdf`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (err) { next(err); }
};


const getAvailableRoomsForBilling = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return sendBadRequest(res, 'กรุณาระบุเดือนและปี');
    }
    const rooms = await BillModel.findAvailableRoomsForBilling(parseInt(month), parseInt(year));
    return sendSuccess(res, rooms);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllBills, getMyBills, getBillById, getBillQR, generateBill,
  cancelBill, getMonthlyReport, exportBillInvoice, getAvailableRoomsForBilling,
};