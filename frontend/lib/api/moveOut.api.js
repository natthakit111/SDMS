// frontend/lib/api/moveOut.api.js
import api from './axiosInstance';

export const moveOutAPI = {
  // tenant: ดูรายการของตัวเอง | admin: ดูทั้งหมด
  getAll: () =>
    api.get('/move-out').then((r) => r.data),

  // tenant only
  create: (data) =>
    api.post('/move-out', data).then((r) => r.data),
  // data: { move_out_date, reason }

  // admin only — พรีวิวยอดคืนเงินประกันก่อนอนุมัติ
  getDepositPreview: (id) =>
    api.get(`/move-out/${id}/deposit-preview`).then((r) => r.data),

  // admin only
  approve: (id, payload) =>
    api.put(`/move-out/${id}/approve`, payload).then((r) => r.data),
  // payload: { admin_note, deduction_extra?, deduction_extra_note? }

  reject: (id, admin_note) =>
    api.put(`/move-out/${id}/reject`, { admin_note }).then((r) => r.data),
};