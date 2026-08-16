/**
 * frondend/lib/api/payment.api.js
 * Backend: /api/payments
 */
import api from './axiosInstance';

// ── เหมือน triggerDownload ใน bill.api.js (ไม่ได้ export มาจากที่นั่น
// เลยทำ local helper แบบเดียวกันซ้ำที่นี่ เพื่อให้ตรง pattern เดิม) ──
const triggerDownload = (blobData, filename) => {
  const url = URL.createObjectURL(new Blob([blobData]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const paymentAPI = {
  // ── Tenant ───────────────────────────────────────────────
  getMyPayments: (params) =>
    api.get('/payments/my', { params }).then((r) => r.data),

  // ⚠️ field ชื่อ `payment_slip` (ต้องตรงกับ multer ใน backend)
  submit: (billId, slipFile, paymentMethod = 'qr_promptpay') => {
    const form = new FormData();
    form.append('bill_id', billId);
    form.append('payment_method', paymentMethod);
    if (slipFile) form.append('payment_slip', slipFile); // ✅ แก้จาก 'slip' → 'payment_slip'
    return api.post('/payments', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  // ── Admin ─────────────────────────────────────────────────
  getAll: (params) =>
    api.get('/payments', { params }).then((r) => r.data),

  getById: (id) =>
    api.get(`/payments/${id}`).then((r) => r.data),

  verify: (id) =>
    api.put(`/payments/${id}/verify`).then((r) => r.data),

  reject: (id, remark) =>
    api.put(`/payments/${id}/reject`, { remark }).then((r) => r.data),

  // ⚠️ endpoint จริงอยู่ใน /reports ไม่ใช่ /payments (ดู
  // routes/report.routes.js — GET /api/reports/payments?format=excel)
  // เอาไว้ export หน้า Payments เป็น Excel ตาม filter ที่ตั้งอยู่บนหน้าจอ
  // (status, payment_method, search) — sanitize/format ทำที่ backend
  // แล้วทั้งหมด (excelSafe) ไม่ต้องทำซ้ำฝั่ง client
  exportExcel: async (params, filename) => {
    const res = await api.get('/reports/payments', {
      params: { ...params, format: 'excel' },
      responseType: 'blob',
    });
    triggerDownload(res.data, filename || 'payments_export.xlsx');
  },
};