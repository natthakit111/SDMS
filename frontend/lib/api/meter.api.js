/**
 * frondend/lib/api/meter.api.js
 * Backend: /api/meters  (Admin only)
 */
import api from './axiosInstance';

export const meterAPI = {
  getAll: (params) =>
    api.get('/meters', { params }).then((r) => r.data),

  getPreviousReading: (roomId, meterType) =>
    api.get(`/meters/rooms/${roomId}/previous`, { params: { type: meterType } }).then((r) => r.data),

  getById: (id) =>
    api.get(`/meters/${id}`).then((r) => r.data),

  // ⚠️ field ชื่อ `meter_image` (ต้องตรงกับ multer ใน backend)
  create: (data, imageFile) => {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => form.append(k, v));
    if (imageFile) form.append('meter_image', imageFile); // ✅ แก้จาก 'image'
    return api.post('/meters', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  update: (id, data, imageFile) => {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => form.append(k, v));
    if (imageFile) form.append('meter_image', imageFile); // ✅ แก้จาก 'image'
    return api.put(`/meters/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  getAvailableRooms: (params) =>
  api.get('/meters/available-rooms', { params }).then((r) => r.data),
};