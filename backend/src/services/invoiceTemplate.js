/**
 * services/invoiceTemplate.js
 *
 * สร้าง HTML string สำหรับใบแจ้งหนี้ (ดีไซน์แบบเอกสารภาษีดั้งเดิม โทนขาว-ดำ เส้นบาง)
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

// ประเภทเอกสาร: ใบแจ้งหนี้ (Invoice) หรือ ใบวางบิล (Billing Note) — ใช้ template เดียวกัน
// สลับได้ผ่าน params.docType เวลาเรียก renderInvoiceHtml
const DOC_TYPE_CONFIG = {
  invoice: { th: 'ใบแจ้งหนี้', en: 'Invoice', numberPrefix: 'INV' },
  billingNote: { th: 'ใบวางบิล', en: 'Billing Note', numberPrefix: 'BN' },
};

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
 * @param {object} params.company - ข้อมูลบริษัท { name, sub, address, taxId, phone, email, bankName, bankBranch, bankAccountName, bankAccountNumber, promptpayId }
 * @param {'invoice'|'billingNote'} [params.docType='invoice'] - ประเภทเอกสาร ใบแจ้งหนี้ หรือ ใบวางบิล
 * @returns {string} HTML เต็มหน้า พร้อมส่งเข้า Puppeteer
 */
function renderInvoiceHtml({ bill, qrDataUrl, company, docType }) {
  const b = bill || {};
  const c = company || {};
  const doc = DOC_TYPE_CONFIG[docType] || DOC_TYPE_CONFIG.invoice;
  const status = b.status || 'pending';
  const statusLabel = BILL_STATUS_TH[status] || status;

  const rent = safeNum(b.rent_amount);
  const electric = safeNum(b.electric_amount);
  const water = safeNum(b.water_amount);
  const other = safeNum(b.other_amount);
  const discount = safeNum(b.discount_amount);
  const total = safeNum(b.total_amount) || (rent + electric + water + other - discount);
  const subtotal = rent + electric + water + other;

  const items = [
    { name: 'ค่าเช่าห้องพัก', qty: 1, unit: 'เดือน', rate: rent, amount: rent },
    {
      name: 'ค่าไฟฟ้า',
      qty: b.elec_units != null ? fmtMoney(b.elec_units) : '-',
      unit: 'หน่วย',
      rate: b.elec_rate != null ? safeNum(b.elec_rate) : '-',
      amount: electric,
    },
    {
      name: 'ค่าน้ำประปา',
      qty: b.water_units != null ? fmtMoney(b.water_units) : '-',
      unit: 'หน่วย',
      rate: b.water_rate != null ? safeNum(b.water_rate) : '-',
      amount: water,
    },
  ];
  if (other > 0) {
    items.push({ name: b.note || 'ค่าใช้จ่ายอื่น ๆ', qty: '-', unit: '-', rate: '-', amount: other });
  }
  // เติมแถวว่างให้ตารางดูสมส่วนเมื่อรายการน้อย (อย่างน้อย 5 แถว)
  const MIN_ROWS = 5;
  while (items.length < MIN_ROWS) items.push({ blank: true });

  const itemsRowsHtml = items.map((item, i) => {
    if (item.blank) {
      return `
      <tr>
        <td class="col-no">&nbsp;</td>
        <td class="col-name">&nbsp;</td>
        <td class="col-qty">&nbsp;</td>
        <td class="col-unit">&nbsp;</td>
        <td class="col-rate">&nbsp;</td>
        <td class="col-discount">&nbsp;</td>
        <td class="col-amount">&nbsp;</td>
      </tr>`;
    }
    return `
      <tr>
        <td class="col-no">${i + 1}</td>
        <td class="col-name">${esc(item.name)}</td>
        <td class="col-qty">${item.qty}</td>
        <td class="col-unit">${esc(item.unit)}</td>
        <td class="col-rate">${item.rate === '-' ? '-' : fmtMoney(item.rate)}</td>
        <td class="col-discount">0.00</td>
        <td class="col-amount">${fmtMoney(item.amount)}</td>
      </tr>`;
  }).join('');

  const needsPayment = status === 'pending' || status === 'overdue';
  const dueDateStr = safeDateStr(b.due_date);
  const issuedDateStr = new Date().toLocaleDateString('th-TH');
  const issuedAtStr = new Date().toLocaleString('th-TH');
  const billIdStr = b.bill_id != null ? String(b.bill_id).padStart(8, '0') : '--------';
  const docCopyLabel = status === 'cancelled' ? 'ยกเลิก' : 'ต้นฉบับ';

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
    margin: 0; font-family: 'Sarabun', sans-serif; color: #1a1a1a; background: #ffffff;
    font-variant-numeric: tabular-nums;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { width: 210mm; padding: 26px 34px 22px; position: relative; }

  /* ── Header ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start; }
  .seller-name { font-weight: 700; font-size: 12.5px; }
  .seller-line { font-size: 8.5px; color: #333333; margin-top: 3px; line-height: 1.55; }
  .seller-line b { color: #1a1a1a; }
  .doc-meta { text-align: right; flex-shrink: 0; }
  .doc-title { font-weight: 700; font-size: 17px; color: #1d4ed8; }
  .doc-title-en { font-size: 8.5px; color: #6b7f96; letter-spacing: 1px; margin-top: 1px; }
  .doc-copy {
    display: inline-block; margin-top: 8px; padding: 2px 10px; border: 1px solid #1a1a1a;
    border-radius: 3px; font-size: 8px; font-weight: 700;
  }
  .doc-numbers { margin-top: 9px; font-size: 8.5px; line-height: 1.7; }
  .doc-numbers .lbl { color: #555555; }
  .doc-numbers b { color: #1a1a1a; }

  .hr { height: 1px; background: #1a1a1a; margin-top: 14px; }
  .hr.light { background: #cfd8e3; }

  /* ── Buyer box ── */
  .buyer { margin-top: 12px; }
  .buyer-label { font-size: 8px; color: #555555; font-weight: 700; }
  .buyer-name { font-weight: 700; font-size: 11px; margin-top: 3px; }
  .buyer-line { font-size: 8.5px; color: #333333; margin-top: 3px; line-height: 1.55; }
  .buyer-line b { color: #1a1a1a; }

  /* ── Items table ── */
  table.items { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 16px; }
  col.col-no       { width: 6%; }
  col.col-name     { width: 32%; }
  col.col-qty      { width: 12%; }
  col.col-unit     { width: 10%; }
  col.col-rate     { width: 14%; }
  col.col-discount { width: 12%; }
  col.col-amount   { width: 14%; }

  table.items thead th {
    border-top: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a;
    font-size: 8px; font-weight: 700; padding: 6px 6px;
  }
  th.col-no, td.col-no { text-align: center; }
  th.col-name, td.col-name { text-align: left; padding-left: 8px; }
  th.col-qty, td.col-qty { text-align: center; }
  th.col-unit, td.col-unit { text-align: center; }
  th.col-rate, td.col-rate { text-align: right; padding-right: 8px; }
  th.col-discount, td.col-discount { text-align: right; padding-right: 8px; }
  th.col-amount, td.col-amount { text-align: right; padding-right: 8px; }
  table.items td {
    padding: 6px 6px; font-size: 9px; height: 22px; vertical-align: top;
    border-bottom: 1px solid #e6e6e6;
  }
  table.items tbody tr:last-child td { border-bottom: 1px solid #1a1a1a; }

  /* ── Totals ── */
  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 4px; }
  .totals { width: 44%; }
  .totals-row {
    display: flex; justify-content: space-between; font-size: 9px; padding: 5px 0;
    border-bottom: 1px solid #e6e6e6;
  }
  .totals-row .lbl { color: #333333; }
  .totals-row .amt { font-weight: 700; }
  .totals-row.grand {
    border-bottom: none; border-top: 1px solid #1a1a1a; margin-top: 2px; padding-top: 7px;
  }
  .totals-row.grand .lbl { font-weight: 700; font-size: 10px; }
  .totals-row.grand .amt { font-weight: 700; font-size: 12px; color: #1d4ed8; }

  .status-badge {
    display: inline-block; margin-top: 10px; padding: 3px 11px; border-radius: 3px;
    font-size: 8px; font-weight: 700;
  }
  .status-pending   { background: #eff5ff; color: #1d4ed8; border: 1px solid #cfe0ff; }
  .status-overdue   { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  .status-paid      { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  .status-cancelled { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }

  /* ── Note ── */
  .note { margin-top: 14px; font-size: 7.5px; color: #6b7f96; line-height: 1.6; }

  /* ── Signature line ── */
  .signature { margin-top: 22px; font-size: 8.5px; }
  .signature .lbl { color: #333333; }

  /* ── Payment section ── */
  .pay-section { display: flex; gap: 20px; margin-top: 22px; }
  .pay-col {
    flex: 1; border: 1px solid #1a1a1a; border-radius: 4px; padding: 12px 14px;
  }
  .pay-col-title { font-size: 9px; font-weight: 700; margin-bottom: 9px; }
  .pay-row { display: flex; font-size: 8.5px; margin-top: 6px; }
  .pay-row .label { color: #555555; width: 78px; flex-shrink: 0; }
  .pay-row .value { font-weight: 700; word-break: break-word; }
  .pay-note { font-size: 7.5px; color: #6b7f96; margin-top: 9px; line-height: 1.55; }

  .qr-col {
    width: 168px; flex-shrink: 0; border: 1px solid #1a1a1a; border-radius: 4px;
    padding: 12px 14px; text-align: center;
  }
  .qr-img { width: 118px; height: 118px; display: block; margin: 6px auto 0; }
  .qr-id { font-size: 8px; color: #555555; margin-top: 6px; }

  /* ── Footer ── */
  .footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #cfd8e3; text-align: center; }
  .footer-main { color: #6b7f96; font-size: 7.5px; }
  .footer-sub { color: #97a7bb; font-size: 7px; margin-top: 4px; }
</style>
</head>
<body>
  <div class="page">

    <!-- Header -->
    <div class="header">
      <div>
        <div class="seller-name">${escOr(c.name, 'บริษัท ผู้ขายตัวอย่าง จำกัด (สำนักงานใหญ่)')}</div>
        <div class="seller-line">${escOr(c.address)}</div>
        <div class="seller-line"><b>เลขประจำตัวผู้เสียภาษี</b> ${escOr(c.taxId)}</div>
        <div class="seller-line"><b>โทร.</b> ${escOr(c.phone)}${c.email ? ` &nbsp;·&nbsp; <b>อีเมล</b> ${esc(c.email)}` : ''}</div>
      </div>
      <div class="doc-meta">
        <div class="doc-title">${doc.th}</div>
        <div class="doc-title-en">${doc.en.toUpperCase()}</div>
        <div class="doc-copy">${docCopyLabel}</div>
        <div class="doc-numbers">
          <div><span class="lbl">เลขที่</span> <b>${doc.numberPrefix}${billIdStr}</b></div>
          <div><span class="lbl">วันที่</span> <b>${issuedDateStr}</b></div>
        </div>
      </div>
    </div>

    <div class="hr"></div>

    <!-- Buyer -->
    <div class="buyer">
      <div class="buyer-label">ลูกค้า</div>
      <div class="buyer-name">${escOr(b.tenant_name)}</div>
      <div class="buyer-line">ห้องพัก ${escOr(b.room_number)} · ชั้น ${escOr(b.floor)}</div>
      <div class="buyer-line"><b>โทร.</b> ${escOr(b.tenant_phone)} &nbsp;·&nbsp; <b>งวดประจำเดือน</b> ${safeMonthYear(b.bill_month, b.bill_year)} &nbsp;·&nbsp; <b>กำหนดชำระ</b> ${dueDateStr}</div>
    </div>

    <!-- Items -->
    <table class="items">
      <colgroup>
        <col class="col-no" /><col class="col-name" /><col class="col-qty" /><col class="col-unit" />
        <col class="col-rate" /><col class="col-discount" /><col class="col-amount" />
      </colgroup>
      <thead>
        <tr>
          <th class="col-no">ลำดับ</th>
          <th class="col-name">รายการ</th>
          <th class="col-qty">จำนวน</th>
          <th class="col-unit">หน่วย</th>
          <th class="col-rate">ราคา/หน่วย</th>
          <th class="col-discount">ส่วนลด</th>
          <th class="col-amount">จำนวนเงิน</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals-wrap">
      <div class="totals">
        <div class="totals-row">
          <span class="lbl">ยอดรวมย่อย</span>
          <span class="amt">${fmtMoney(subtotal)} บาท</span>
        </div>
        <div class="totals-row">
          <span class="lbl">ส่วนลด</span>
          <span class="amt">${fmtMoney(discount)} บาท</span>
        </div>
        <div class="totals-row grand">
          <span class="lbl">รวมเป็นเงิน</span>
          <span class="amt">${fmtMoney(total)} บาท</span>
        </div>
      </div>
    </div>

    <div style="text-align:right;">
      <span class="status-badge status-${status}">${esc(statusLabel)}</span>
    </div>

    <div class="note">
      เอกสารนี้ได้จัดทำขึ้นด้วยระบบอิเล็กทรอนิกส์โดย ${escOr(c.name, 'บริษัท ผู้ขายตัวอย่าง จำกัด')} · ออกเอกสารเมื่อ ${issuedAtStr}
    </div>

    <div class="signature">
      <span class="lbl">ผู้จัดทำ</span> ${escOr(c.name, 'บริษัท ผู้ขายตัวอย่าง จำกัด')}
    </div>

    ${needsPayment ? `
    <div class="pay-section">
      <div class="pay-col">
        <div class="pay-col-title">ช่องทางการชำระเงิน</div>
        <div class="pay-row"><span class="label">ธนาคาร</span><span class="value">${escOr(c.bankName)} ${c.bankBranch ? `สาขา ${esc(c.bankBranch)}` : ''}</span></div>
        <div class="pay-row"><span class="label">ชื่อบัญชี</span><span class="value">${escOr(c.bankAccountName)}</span></div>
        <div class="pay-row"><span class="label">เลขบัญชี</span><span class="value">${escOr(c.bankAccountNumber)}</span></div>
        <div class="pay-note">กรุณาชำระภายในวันที่กำหนด และเก็บหลักฐานการโอนไว้เพื่อยืนยันการชำระเงิน · ระบบจะอัปเดตสถานะเป็น "ชำระแล้ว" หลังตรวจสอบยอดโอน${c.email ? ` หรือแจ้งที่ ${esc(c.email)}` : ''}</div>
      </div>
      ${qrDataUrl ? `
      <div class="qr-col">
        <div class="pay-col-title">พร้อมเพย์ QR</div>
        <img class="qr-img" src="${qrDataUrl}" />
        <div class="qr-id">เลขที่ ${escOr(c.promptpayId)}</div>
      </div>` : ''}
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <div class="footer-main">เอกสารนี้ออกโดยระบบอัตโนมัติ · ${escOr(c.name, 'Smart Dormitory')}</div>
      <div class="footer-sub">เลขประจำตัวผู้เสียภาษี ${escOr(c.taxId)} · โทร. ${escOr(c.phone)}</div>
    </div>

  </div>
</body>
</html>`;
}

module.exports = { renderInvoiceHtml };