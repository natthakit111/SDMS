/**
 * services/invoiceTemplate.js
 *
 * สร้าง HTML string สำหรับใบแจ้งหนี้ (โทนขาว-ฟ้า)
 * ใช้กับ services/pdf.service.js (Puppeteer) เพื่อแปลงเป็น PDF
 *
 * ฟอนต์ Sarabun ถูกอ่านจากไฟล์แล้วฝังเป็น base64 (data URI) ใน <style>
 * เพื่อให้ Chromium ใช้ฟอนต์ได้แน่นอน ไม่ต้องพึ่งอินเทอร์เน็ตหรือ path ของระบบไฟล์
 *
 * ⚠️ ทุกฟิลด์ของ bill ผ่าน safe helper ก่อนใช้เสมอ (safeNum / safeDateStr / esc)
 * เพื่อไม่ให้ข้อมูลที่ขาด/ผิดปกติ (null, undefined, NaN, invalid date) ทำให้ template พัง
 */
const fs = require('fs');
const path = require('path');

const FONT_REGULAR_B64 = fs
  .readFileSync(path.join(__dirname, '../assets/fonts/Sarabun-Regular.ttf'))
  .toString('base64');
const FONT_BOLD_B64 = fs
  .readFileSync(path.join(__dirname, '../assets/fonts/Sarabun-Bold.ttf'))
  .toString('base64');

const THAI_MONTHS_FULL = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const BILL_STATUS_TH = { pending: 'รอชำระ', paid: 'ชำระแล้ว', overdue: 'เกินกำหนด', cancelled: 'ยกเลิก' };
const STATUS_CLASS = { pending: 'badge-pending', paid: 'badge-paid', overdue: 'badge-overdue', cancelled: 'badge-cancelled' };

// ── Safe helpers: ป้องกัน template พังจากข้อมูลที่ขาด/ผิดปกติ ──────────────
const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmtMoney = (v) => safeNum(v).toLocaleString('th-TH', { minimumFractionDigits: 2 });
const safeDateStr = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('th-TH');
};
const safeMonthYear = (month, year) => {
  const m = THAI_MONTHS_FULL[safeNum(month)] || '-';
  const y = safeNum(year) ? safeNum(year) + 543 : '-';
  return `${m} ${y}`;
};

// ป้องกัน HTML injection จากข้อมูลที่มาจากฐานข้อมูล (ชื่อผู้เช่า, เบอร์โทร ฯลฯ)
const esc = (v) => String(v ?? '-').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const escOr = (v, fallback = '-') => esc(v === null || v === undefined || v === '' ? fallback : v);

/**
 * @param {object} params
 * @param {object} params.bill - ข้อมูลบิล (จาก BillModel.findByIdWithMeters)
 * @param {string|null} params.qrDataUrl - QR PromptPay เป็น data:image/png;base64,... (จาก qrcode.toDataURL)
 * @param {object} params.company - ข้อมูลบริษัท { name, sub, address, taxId, phone, bankAccountName, promptpayId }
 * @returns {string} HTML เต็มหน้า พร้อมส่งเข้า Puppeteer
 */
function renderInvoiceHtml({ bill, qrDataUrl, company }) {
  const b = bill || {};
  const status = b.status || 'pending';
  const statusLabel = BILL_STATUS_TH[status] || status;
  const statusClass = STATUS_CLASS[status] || 'badge-pending';

  const rent = safeNum(b.rent_amount);
  const electric = safeNum(b.electric_amount);
  const water = safeNum(b.water_amount);
  const other = safeNum(b.other_amount);
  const total = safeNum(b.total_amount) || (rent + electric + water + other);
  const subtotal = rent + electric + water + other;

  const items = [
    { name: 'ค่าเช่าห้องพัก', sub: 'อัตราเหมาจ่ายรายเดือน', units: '-', rate: '-', amount: rent },
    {
      name: 'ค่าไฟฟ้า',
      sub: b.elec_rate != null ? `หน่วยละ ${fmtMoney(b.elec_rate)} บาท` : null,
      units: b.elec_units != null ? fmtMoney(b.elec_units) : '-',
      rate: b.elec_rate != null ? fmtMoney(b.elec_rate) : '-',
      amount: electric,
    },
    {
      name: 'ค่าน้ำประปา',
      sub: b.water_rate != null ? `หน่วยละ ${fmtMoney(b.water_rate)} บาท` : null,
      units: b.water_units != null ? fmtMoney(b.water_units) : '-',
      rate: b.water_rate != null ? fmtMoney(b.water_rate) : '-',
      amount: water,
    },
  ];
  if (other > 0) {
    items.push({ name: 'ค่าใช้จ่ายอื่น ๆ', sub: null, units: '-', rate: '-', amount: other });
  }

  const itemsRowsHtml = items.map((item) => `
    <tr>
      <td class="col-name">
        <div class="item-name">${esc(item.name)}</div>
        ${item.sub ? `<div class="item-sub">${esc(item.sub)}</div>` : ''}
      </td>
      <td class="col-units">${esc(item.units)}</td>
      <td class="col-rate">${esc(item.rate)}</td>
      <td class="col-amount">${fmtMoney(item.amount)}</td>
    </tr>
  `).join('');

  const needsPayment = status === 'pending' || status === 'overdue';
  const dueDateStr = safeDateStr(b.due_date);
  const issuedDateStr = new Date().toLocaleDateString('th-TH');
  const issuedAtStr = new Date().toLocaleString('th-TH');
  const billIdStr = b.bill_id != null ? String(b.bill_id).padStart(6, '0') : '------';

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<style>
  @font-face {
    font-family: 'Sarabun';
    src: url(data:font/ttf;base64,${FONT_REGULAR_B64}) format('truetype');
    font-weight: 400;
  }
  @font-face {
    font-family: 'Sarabun';
    src: url(data:font/ttf;base64,${FONT_BOLD_B64}) format('truetype');
    font-weight: 700;
  }
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: 'Sarabun', sans-serif; color: #17293d; background: #ffffff;
    font-variant-numeric: tabular-nums; /* ตัวเลขกว้างเท่ากันทุกหลัก ป้องกันจำนวนเงินเยื้องแนว */
  }

  .page { width: 210mm; min-height: 297mm; padding: 40px; }

  /* ── Header ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { display: flex; gap: 12px; }
  .logo {
    width: 40px; height: 40px; border-radius: 8px; background: #e3f0ff;
    color: #17293d; font-weight: 700; font-size: 14px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .brand-name { font-weight: 700; font-size: 14px; }
  .brand-sub { color: #1d4ed8; font-size: 8px; margin-top: 3px; }
  .brand-address { color: #47617a; font-size: 8px; margin-top: 3px; max-width: 260px; }

  .invoice-meta { text-align: right; }
  .invoice-title { font-weight: 700; font-size: 18px; }
  .invoice-label { color: #47617a; font-size: 8px; letter-spacing: 1px; margin-top: 3px; }
  .invoice-number { font-weight: 700; font-size: 11px; margin-top: 5px; }
  .badge {
    display: inline-block; margin-top: 8px; padding: 4px 14px; border-radius: 9px;
    font-size: 8px; font-weight: 700;
  }
  .badge-paid { background: #dcfce7; color: #15803d; }
  .badge-pending { background: #fef3c7; color: #b45309; }
  .badge-overdue { background: #fee2e2; color: #b91c1c; }
  .badge-cancelled { background: #e5e7eb; color: #4b5563; }

  .divider { height: 1px; background: #dbe7f5; margin: 20px 0; }

  /* ── Info cards ── */
  .info-cards { display: flex; gap: 16px; margin-bottom: 24px; }
  .card { flex: 1; background: #f0f7ff; border-radius: 8px; padding: 14px; }
  .card-label { color: #47617a; font-size: 8px; }
  .tenant-name { font-weight: 700; font-size: 12px; margin-top: 6px; }
  .info-line { color: #33475a; font-size: 9px; margin-top: 6px; }
  .info-row { display: flex; justify-content: space-between; font-size: 9px; padding: 5px 0; }
  .info-row .label { color: #47617a; }
  .info-row .value { font-weight: 700; }
  .info-hr { height: 1px; background: #dbe7f5; }

  /* ── Items table (fixed layout — คอลัมน์ตรงเสมอ ไม่ขยับตามความยาวข้อความ) ── */
  table.items { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 8px; }
  col.col-name   { width: 46%; }
  col.col-units  { width: 16%; }
  col.col-rate   { width: 16%; }
  col.col-amount { width: 22%; }

  table.items thead th {
    color: #47617a; font-size: 8px; font-weight: 400;
    padding: 0 0 8px 0; border-bottom: 1px solid #dbe7f5;
  }
  /* จัด alignment ทีละคอลัมน์ ใช้ selector เดียวกันทั้ง th และ td
     เพื่อไม่ให้ specificity ชนกับกฎ "thead th" ด้านบน (ห้ามตั้ง text-align ซ้ำที่นั่น) */
  th.col-name, td.col-name { text-align: left; }
  th.col-units, td.col-units { text-align: center; }
  th.col-rate, td.col-rate { text-align: center; }
  th.col-amount, td.col-amount { text-align: right; padding-right: 0; }
  table.items td {
    padding: 10px 0; border-bottom: 1px solid #dbe7f5; vertical-align: top; font-size: 9px;
    overflow-wrap: break-word;
  }
  .item-name { font-weight: 700; font-size: 10px; }
  .item-sub { color: #47617a; font-size: 8px; margin-top: 2px; }
  td.col-amount { font-weight: 700; font-size: 10px; white-space: nowrap; }

  /* ── Totals (ชิดขอบขวาเดียวกับคอลัมน์จำนวนเงินในตาราง) ── */
  .totals { margin-top: 16px; }
  .subtotal-row {
    display: flex; justify-content: space-between; font-size: 9px; color: #47617a; padding: 4px 0;
  }
  .subtotal-row .amt { color: #17293d; font-weight: 700; white-space: nowrap; }
  .total-box {
    display: flex; justify-content: space-between; align-items: center;
    background: #e8f1ff; border-radius: 6px; padding: 12px 16px; margin-top: 8px; font-weight: 700;
  }
  .total-label { font-size: 12px; }
  .total-amount { color: #1d4ed8; font-size: 14px; white-space: nowrap; }

  /* ── Payment box ── */
  .pay-box {
    display: flex; gap: 20px; background: #f0f7ff; border-radius: 8px; padding: 16px; margin-top: 24px;
  }
  .qr-wrap { width: 110px; text-align: center; flex-shrink: 0; }
  .qr-img { width: 98px; height: 98px; }
  .qr-caption { color: #1d4ed8; font-size: 7.5px; margin-top: 6px; }
  .pay-info { flex: 1; min-width: 0; }
  .pay-title { font-weight: 700; font-size: 10px; margin-bottom: 10px; }
  .pay-row { display: flex; font-size: 9px; margin-bottom: 6px; }
  .pay-row .label { color: #47617a; width: 80px; flex-shrink: 0; }
  .pay-row .value { font-weight: 700; word-break: break-word; }
  .pay-note { color: #47617a; font-size: 7.5px; margin-top: 8px; line-height: 1.5; }

  /* ── Status note (แสดงแทนกล่อง QR เมื่อบิลไม่ต้องชำระแล้ว) ── */
  .status-note {
    display: flex; align-items: flex-start; gap: 12px;
    border-radius: 8px; padding: 16px; margin-top: 24px;
  }
  .status-note-icon {
    width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
  }
  .status-note-title { font-weight: 700; font-size: 10px; }
  .status-note-sub { font-size: 8px; margin-top: 4px; line-height: 1.5; }
  .status-note-paid { background: #f0fdf4; }
  .status-note-paid .status-note-icon { background: #dcfce7; color: #15803d; }
  .status-note-paid .status-note-title { color: #15803d; }
  .status-note-paid .status-note-sub { color: #47617a; }
  .status-note-cancelled { background: #f8fafc; }
  .status-note-cancelled .status-note-icon { background: #e5e7eb; color: #4b5563; }
  .status-note-cancelled .status-note-title { color: #4b5563; }
  .status-note-cancelled .status-note-sub { color: #47617a; }

  /* ── Footer ── */
  .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid #dbe7f5; text-align: center; }
  .footer-main { color: #47617a; font-size: 8px; }
  .footer-sub { color: #47617a; font-size: 7px; margin-top: 6px; }
</style>
</head>
<body>
  <div class="page">

    <div class="header">
      <div class="brand">
        <div class="logo">SD</div>
        <div>
          <div class="brand-name">${escOr(company.name, 'Smart Dormitory')}</div>
          <div class="brand-sub">${escOr(company.sub, '')}</div>
          <div class="brand-address">${escOr(company.address, '')}</div>
        </div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-title">ใบแจ้งหนี้</div>
        <div class="invoice-label">INVOICE</div>
        <div class="invoice-number">INV-${billIdStr}</div>
        <div class="badge ${statusClass}">${esc(statusLabel)}</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="info-cards">
      <div class="card">
        <div class="card-label">เรียกเก็บจาก</div>
        <div class="tenant-name">${escOr(b.tenant_name)}</div>
        <div class="info-line">ห้องพัก ${escOr(b.room_number)} (ชั้น ${escOr(b.floor)})</div>
        <div class="info-line">${escOr(b.tenant_phone)}</div>
      </div>
      <div class="card">
        <div class="info-row">
          <span class="label">งวดประจำเดือน</span>
          <span class="value">${safeMonthYear(b.bill_month, b.bill_year)}</span>
        </div>
        <div class="info-hr"></div>
        <div class="info-row">
          <span class="label">วันที่ออกเอกสาร</span>
          <span class="value">${issuedDateStr}</span>
        </div>
        <div class="info-hr"></div>
        <div class="info-row">
          <span class="label">กำหนดชำระ</span>
          <span class="value">${dueDateStr}</span>
        </div>
      </div>
    </div>

    <table class="items">
      <colgroup>
        <col class="col-name" /><col class="col-units" /><col class="col-rate" /><col class="col-amount" />
      </colgroup>
      <thead>
        <tr>
          <th class="col-name">รายการ</th>
          <th class="col-units">หน่วยที่ใช้</th>
          <th class="col-rate">อัตรา/หน่วย</th>
          <th class="col-amount">จำนวนเงิน (บาท)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
      </tbody>
    </table>

    <div class="totals">
      <div class="subtotal-row">
        <span>ยอดรวมย่อย</span>
        <span class="amt">${fmtMoney(subtotal)}</span>
      </div>
      <div class="total-box">
        <span class="total-label">ยอดชำระทั้งสิ้น</span>
        <span class="total-amount">${fmtMoney(total)} บาท</span>
      </div>
    </div>

    ${needsPayment ? `
    <div class="pay-box">
      ${qrDataUrl ? `
      <div class="qr-wrap">
        <img class="qr-img" src="${qrDataUrl}" />
        <div class="qr-caption">สแกนเพื่อชำระผ่าน PromptPay</div>
      </div>` : ''}
      <div class="pay-info">
        <div class="pay-title">รายละเอียดการชำระเงิน</div>
        <div class="pay-row"><span class="label">พร้อมเพย์</span><span class="value">${escOr(company.promptpayId)}</span></div>
        <div class="pay-row"><span class="label">ชื่อบัญชี</span><span class="value">${escOr(company.bankAccountName)}</span></div>
        <div class="pay-row"><span class="label">ยอดชำระ</span><span class="value">${fmtMoney(total)} บาท</span></div>
        <div class="pay-note">กรุณาชำระภายในวันที่กำหนด และเก็บหลักฐานการโอนไว้เพื่อยืนยันการชำระเงิน</div>
      </div>
    </div>
    ` : status === 'paid' ? `
    <div class="status-note status-note-paid">
      <span class="status-note-icon">✓</span>
      <div>
        <div class="status-note-title">ชำระเงินเรียบร้อยแล้ว</div>
        <div class="status-note-sub">ขอบคุณที่ชำระเงินตรงเวลา — ต้องการใบเสร็จรับเงินสามารถขอออกใบเสร็จแยกได้จากระบบ</div>
      </div>
    </div>
    ` : status === 'cancelled' ? `
    <div class="status-note status-note-cancelled">
      <span class="status-note-icon">✕</span>
      <div>
        <div class="status-note-title">ใบแจ้งหนี้นี้ถูกยกเลิก</div>
        <div class="status-note-sub">เอกสารนี้ไม่มีผลผูกพันการชำระเงิน กรุณาติดต่อผู้ดูแลระบบหากมีข้อสงสัย</div>
      </div>
    </div>
    ` : ''}

    <div class="footer">
      <div class="footer-main">ขอบคุณที่ใช้บริการหอพักของเรา · เอกสารนี้ออกโดยระบบอัตโนมัติ</div>
      <div class="footer-sub">เลขประจำตัวผู้เสียภาษี ${escOr(company.taxId)} · โทร. ${escOr(company.phone)} · ออกเอกสารเมื่อ ${issuedAtStr}</div>
    </div>

  </div>
</body>
</html>`;
}

module.exports = { renderInvoiceHtml };