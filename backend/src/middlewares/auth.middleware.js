/**
 * middlewares/auth.middleware.js
 * Verifies the JWT stored in an httpOnly cookie.
 * Attaches decoded payload to req.user.
 *
 * Responsibility: Authentication only ("who are you?")
 * For role-based access control ("what can you do?"), see role.middleware.js
 *
 * ⚠️ SECURITY MIGRATION (localStorage → httpOnly cookie):
 * เดิมอ่าน JWT จาก `Authorization: Bearer <token>` header ซึ่ง frontend
 * ต้องดึง token จาก localStorage มาแนบเอง — ถ้าเกิด XSS ที่ไหนในระบบ
 * เมื่อไหร่ JS ตัวไหนก็ตามอ่าน localStorage ได้ตรงๆ token หลุดทันที
 *
 * เปลี่ยนมาอ่านจาก httpOnly cookie แทน — เบราว์เซอร์แนบ cookie ให้เอง
 * อัตโนมัติทุก request (ไม่ต้องพึ่ง frontend แนบ header เอง) และ JS
 * แตะ cookie httpOnly ไม่ได้เลยแม้มี XSS เกิดขึ้นจริง
 *
 * ต้องมี middleware `cookie-parser` ติดตั้งและ mount ไว้ก่อนถึงจุดนี้ใน
 * app.js (ดู npm install cookie-parser + app.use(cookieParser()))
 *
 * คงรองรับ Authorization header ไว้ด้วยชั่วคราว (fallback) ระหว่างช่วง
 * เปลี่ยนผ่าน เผื่อมี client อื่น (เช่น mobile app ในอนาคต) ที่ยังส่งผ่าน
 * header อยู่ — ถ้ามั่นใจว่าไม่มีใครใช้ header แล้วค่อยตัด fallback ออก
 */

const jwt = require('jsonwebtoken');
const { sendUnauthorized } = require('../utils/response');
const UserModel = require('../models/user.model');

/**
 * authenticate
 * Middleware that validates the JWT from cookie (หลัก) หรือ Authorization
 * header (fallback ชั่วคราว).
 * Usage: router.get('/protected', authenticate, controller)
 */

const authenticate = async (req, res, next) => {
    // ── ทางหลัก: httpOnly cookie ──
  let token = req.cookies?.token;
  // ── Fallback ชั่วคราว: Authorization header ──
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }
  if (!token) return sendUnauthorized(res, 'No token provided');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let active;
    try {
      active = await UserModel.isUserActive(decoded.user_id);
    } catch (dbErr) {
      // ⚠️ ถ้า DB พังตอนเช็ค is_active — fail-closed (ปฏิเสธ) ปลอดภัยกว่า
      // fail-open เพราะนี่คือ auth gate ไม่ใช่แค่ feature เสริม
      console.error('[Auth] is_active check failed:', dbErr.message);
      return sendUnauthorized(res, 'Authentication check failed, please try again');
    }

    if (!active) {
      res.clearCookie('token', { path: '/' });
      res.clearCookie('auth_hint', { path: '/' });
      res.clearCookie('csrf_token', { path: '/' });
      return sendUnauthorized(res, 'บัญชีนี้ถูกปิดการใช้งาน');
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return sendUnauthorized(res, 'Token has expired');
    return sendUnauthorized(res, 'Invalid token');
  }
};

module.exports = { authenticate };