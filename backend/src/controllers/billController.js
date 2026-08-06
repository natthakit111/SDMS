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

const getAllBills = async (req, res, next) => {
  try {
    const { room_id, status, month, year, tenant_id } = req.query;
    const bills = await BillModel.findAll({ room_id, status, month, year, tenant_id });
    return sendSuccess(res, bills);
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

    const { room_id, month, year, other_amount = 0, due_date: customDueDate } = req.body;

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

    const billId = await BillModel.create({
      contract_id: contract.contract_id, room_id: parseInt(room_id),
      bill_month: parseInt(month), bill_year: parseInt(year),
      rent_amount: amounts.rent_amount, electric_amount: amounts.electric_amount,
      water_amount: amounts.water_amount, other_amount: amounts.other_amount,
      total_amount: amounts.total_amount, due_date, qr_payload: qrPayload,
    });

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

// ── ข้อมูลบริษัท — ปรับผ่าน env ได้ ไม่ต้องแก้โค้ด ──
const COMPANY = {
  name: process.env.COMPANY_NAME || 'Smart Dormitory',
  sub: process.env.COMPANY_SUB || 'Smart Dormitory Management System',
  address: process.env.COMPANY_ADDRESS || '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
  taxId: process.env.COMPANY_TAX_ID || '0-1055-12345-67-8',
  phone: process.env.COMPANY_PHONE || '02-123-4567',
  bankAccountName: process.env.BANK_ACCOUNT_NAME || 'Smart Dormitory Management',
  promptpayId: process.env.PROMPTPAY_ID || null,
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

    const html = renderInvoiceHtml({ bill, qrDataUrl, company: COMPANY });
    const pdfBuffer = await htmlToPdfBuffer(html);

    // ⚠️ สำคัญ: ต้องบังคับแปลงเป็น Buffer จริง ๆ ก่อนส่ง
    // เพราะ Express res.send() จะเรียก res.json() ให้อัตโนมัติถ้า argument
    // เป็น object แต่ไม่ใช่ Buffer แท้ (Buffer.isBuffer() === false)
    // ซึ่งบางเวอร์ชันของ Puppeteer คืนค่า page.pdf() เป็น Uint8Array ธรรมดา
    // ไม่ใช่ Node Buffer ทำให้ Express stringify เป็น JSON แทนที่จะส่งไบต์ตรงๆ
    const buffer = Buffer.from(pdfBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${bill.bill_id}.pdf`);
    res.setHeader('Content-Length', buffer.length);
    // ใช้ res.end() แทน res.send() เพื่อส่ง binary ตรงๆ โดยไม่ผ่านการเดา type ของ Express
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