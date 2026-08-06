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

/**
 * authenticate
 * Middleware that validates the JWT from cookie (หลัก) หรือ Authorization
 * header (fallback ชั่วคราว).
 * Usage: router.get('/protected', authenticate, controller)
 */
const authenticate = (req, res, next) => {
  // ── ทางหลัก: httpOnly cookie ──
  let token = req.cookies?.token;

  // ── Fallback ชั่วคราว: Authorization header ──
  // เก็บไว้ระหว่าง migrate เท่านั้น ลบทิ้งเมื่อ client ทุกตัวย้ายมาใช้
  // cookie ครบแล้ว (ไม่งั้นเปิดช่องให้ยังส่ง token ผ่าน header ได้อยู่ดี
  // ซึ่งขัดจุดประสงค์การย้ายมา cookie)
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return sendUnauthorized(res, 'No token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { user_id, username, role }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendUnauthorized(res, 'Token has expired');
    }
    return sendUnauthorized(res, 'Invalid token');
  }
};

module.exports = { authenticate };