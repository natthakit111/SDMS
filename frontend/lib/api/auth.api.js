/**
 * frondend/lib/api/auth.api.js
 * Backend: POST /auth/login ใช้ field `username` (ไม่ใช่ email)
 */
import api from './axiosInstance';

export const authAPI = {
  // Tenant self-register — ไม่ต้องการ token
  register: (data) =>
    api.post('/auth/register', data).then((r) => r.data),

  // data: { username, password, role? }
  // ⚠️ field ชื่อ `username` ไม่ใช่ `email`
  login: (username, password, rememberMe) =>
    api.post('/auth/login', { username, password, rememberMe }).then((r) => r.data),

  forgotPassword: (username) =>
    api.post('/auth/forgot-password', { username }).then((r) => r.data),

  // เช็คว่า token รีเซ็ตรหัสผ่านยังใช้ได้จริงไหม ไม่ consume/ลบ token —
  // ใช้เช็คตอนโหลดหน้า /reset-password ก่อนโชว์ฟอร์ม
  verifyResetToken: (token) =>
    api.get('/auth/verify-reset-token', { params: { token } }).then((r) => r.data),

  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, newPassword }).then((r) => r.data),

  // returns: { token, user: { user_id, username, role } }
  getMe: () =>
    api.get('/auth/me').then((r) => r.data),

  // ✅ เพิ่ม: อัปเดตข้อมูลโปรไฟล์
  updateProfile: ({ firstName, lastName, email, phone }) =>
    api.put('/auth/profile', { firstName, lastName, email, phone }).then((r) => r.data),

  changePassword: (currentPassword, newPassword) =>
    api.put('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),

  // OAuth user ตั้งรหัสผ่านครั้งแรก (ไม่ต้องใส่รหัสเดิม)
  setPassword: (newPassword) =>
    api.post('/auth/set-password', { newPassword }).then((r) => r.data),
};