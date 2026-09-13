/**
 * frondend/lib/api/auth.api.js
 * Backend: POST /auth/login ใช้ field `username` (ไม่ใช่ email)
 */
import api from './axiosInstance';

export const authAPI = {
  // ⚠️ self-register เปลี่ยนเป็น 3 ขั้นตอน — ต้องยืนยันอีเมลด้วย OTP ก่อน
  // ถึงจะไปกรอกเบอร์/ตั้งรหัสผ่านได้:
  //   1) requestRegistrationOtp(email) — ขอรหัส OTP 6 หลัก
  //   2) verifyRegistrationOtp(email, code) — ยืนยันรหัส ได้ ticket กลับมา
  //   3) register({ ticket, name, phone, password }) — สมัครจริง (ไม่ส่ง
  //      email ตรงๆ อีกต่อไป อีเมลถอดจาก ticket ที่ยืนยันแล้วฝั่ง backend)
  requestRegistrationOtp: (email) =>
    api.post('/auth/register/request-otp', { email }).then((r) => r.data),

  verifyRegistrationOtp: (email, code) =>
    api.post('/auth/register/verify-otp', { email, code }).then((r) => r.data),

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

  // เช็ค/consume token ยืนยันอีเมล — ใช้ตอนโหลดหน้า /verify-email
  verifyEmail: (token) =>
    api.get('/auth/verify-email', { params: { token } }).then((r) => r.data),

  // ขอลิงก์ยืนยันอีเมลใหม่ — ใช้ตอนยัง login ไม่ได้ (โดน AUTH_EMAIL_NOT_VERIFIED)
  resendVerification: (username) =>
    api.post('/auth/resend-verification', { username }).then((r) => r.data),

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