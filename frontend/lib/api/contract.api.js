/**
 * frontend/lib/api/contract.api.js
 * Backend: /api/contracts
 */
import api from './axiosInstance';

export const contractAPI = {
  // ── Tenant ───────────────────────────────────────────────
  getMyContract: () =>
    api.get('/contracts/my').then((r) => r.data),
  // /my/active ก็ใช้ได้เช่นกัน (backend มี alias ให้แล้ว)

  // ── Admin ─────────────────────────────────────────────────
  getAll: (params) =>
    api.get('/contracts', { params }).then((r) => r.data),

  getById: (id) =>
    api.get(`/contracts/${id}`).then((r) => r.data),

  create: (data) =>
    api.post('/contracts', data).then((r) => r.data),
  // data: { tenant_id, room_id, start_date, end_date, deposit_amount?, rent_amount? }

  update: (id, data) =>
    api.put(`/contracts/${id}`, data).then((r) => r.data),
  // data: { end_date?, rent_amount? } — ใช้ได้เฉพาะสัญญาที่ status = 'active' เท่านั้น

  renew: (id, data) =>
    api.put(`/contracts/${id}/renew`, data).then((r) => r.data),
  // data: { end_date, rent_amount? } — ใช้กับสัญญาที่ status = 'expired' เท่านั้น (ต่อสัญญากลับเป็น active)

  terminate: (id, data) =>
    api.put(`/contracts/${id}/terminate`, data).then((r) => r.data),
  // data?: { checkout_date? } — ใช้ได้กับสัญญา status = 'active' (ยกเลิกก่อนกำหนด)
  // หรือ 'expired' (แอดมินเคลียร์ห้องหลังหมดสัญญา / ทำเรื่องย้ายออก) ไม่มีค่าปรับถ้าเช็คเอาท์หลังวันหมดสัญญา

  uploadFile: (id, file) => {
    const formData = new FormData();
    // ⚠️ field ชื่อ `contract_file` (ต้องตรงกับ Cloudinary multer ใน backend
    // upload.middleware.js — เดิม backend ใช้ multer diskStorage แยกเอง
    // field name 'file', ย้ายมาใช้ Cloudinary middleware กลางแล้ว field
    // name เปลี่ยนเป็น 'contract_file' ตาม FIELD_CONFIG)
    formData.append('contract_file', file);
    return api
      .post(`/contracts/${id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  // file: File object จาก <input type="file"> — เฉพาะ admin, รองรับ .pdf เท่านั้น ไม่เกิน 5MB

  downloadFile: (id) =>
    api.get(`/contracts/${id}/file`, { responseType: 'blob' }),
  // คืนค่าเป็น blob response — tenant ดาวน์โหลดได้เฉพาะสัญญาของตัวเอง, admin ดาวน์โหลดได้ทุกฉบับ
};