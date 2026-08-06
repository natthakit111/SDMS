/**
 * frontend/lib/api/tenant.api.js
 * Backend: /api/tenants
 */
import api from './axiosInstance';

const noCache = { headers: { 'Cache-Control': 'no-cache' } };

export const tenantAPI = {
  getMyProfile: () =>
    api.get('/tenants/me/profile', noCache).then((r) => r.data),

  updateMyProfile: (data) =>
    api.put('/tenants/me/profile', data).then((r) => r.data),

  getAll: (params) =>
    api.get('/tenants', { params, ...noCache }).then((r) => r.data),

  getById: (id) =>
    api.get(`/tenants/${id}`, noCache).then((r) => r.data),

  create: (data) =>
    api.post('/tenants', data).then((r) => r.data),
  // data: { password, first_name, last_name, id_card_number, phone, email?,
  //         emergency_contact_name?, emergency_contact_phone? }
  // ไม่ต้องส่ง username — backend ใช้ phone เป็น username อัตโนมัติ

  update: (id, data) =>
    api.put(`/tenants/${id}`, data).then((r) => r.data),

  delete: (id) =>
    api.delete(`/tenants/${id}`).then((r) => r.data),
};