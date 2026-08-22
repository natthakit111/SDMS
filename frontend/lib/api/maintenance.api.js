/**
 * frondend/lib/api/maintenance.api.js
 * Backend: /api/maintenance
 */
import api from './axiosInstance';

export const maintenanceAPI = {
  // ── Tenant ───────────────────────────────────────────────
  getMyRequests: (params) =>
    api.get('/maintenance/my', { params }).then((r) => r.data),

  // ⚠️ field ชื่อ `meter_image` (ใช้ uploadMeterImage middleware เดียวกัน)
  create: (data, imageFile) => {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => form.append(k, v));
    if (imageFile) form.append('meter_image', imageFile); // ✅ แก้จาก 'image'
    return api.post('/maintenance', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  cancel: (id) =>
    api.put(`/maintenance/${id}/cancel`).then((r) => r.data),

  // ── Admin ─────────────────────────────────────────────────
  getStats: () =>
    api.get('/maintenance/stats').then((r) => r.data),

  getAdmins: () =>
    api.get('/maintenance/admins').then((r) => r.data),

  getAll: (params) =>
    api.get('/maintenance', { params }).then((r) => r.data),

  getById: (id) =>
    api.get(`/maintenance/${id}`).then((r) => r.data),

  // ✅ ส่ง status, admin_note, assigned_to ครบ
  updateStatus: (id, data) =>
    api.put(`/maintenance/${id}/status`, data).then((r) => r.data),
  // data: { status, admin_note?, assigned_to? }
};