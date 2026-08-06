/**
 * middlewares/csrf.middleware.js
 *
 * ⚠️ จำเป็นเพราะ frontend/backend อยู่คนละโดเมนกัน (production)
 *
 * Cookie `token` ต้องใช้ sameSite: 'none' (ไม่งั้น cross-site request
 * จะไม่แนบ cookie มาเลย ใช้งานจริงไม่ได้) แต่ sameSite: 'none' แปลว่า
 * เกราะป้องกัน CSRF ที่ sameSite เคยให้ฟรีๆ (บล็อก cross-site request
 * ไม่ให้แนบ cookie) หายไปทันที — เว็บไซต์ไหนก็ตามสามารถสั่งให้ browser
 * ยิง request (พร้อม cookie ของผู้ใช้) มาที่ API นี้ได้แล้ว
 *
 * แก้ด้วย double-submit cookie pattern:
 *   1. ตอน login สำเร็จ ออก csrf token สุ่ม ฝังไว้ทั้งใน JWT (`csrf` claim,
 *      backend ตรวจได้จาก cookie `token` ที่ verify แล้ว) และ cookie
 *      แยกที่ JS อ่านได้ (`csrf_token`, ไม่ httpOnly)
 *   2. Frontend อ่านค่าจาก cookie `csrf_token` แล้วแนบเป็น header
 *      `X-CSRF-Token` ทุก request ที่เปลี่ยนแปลงข้อมูล (ดู axiosInstance.js)
 *   3. Middleware นี้เช็คว่า header ตรงกับค่าใน JWT ไหม
 *
 * เว็บอื่น (evil.com) สั่งให้ browser ยิง request พร้อม cookie ได้ก็จริง
 * แต่ "อ่านค่า" cookie `csrf_token` ของโดเมนเราไปแนบเป็น header เองไม่ได้
 * เลย เพราะ Same-Origin Policy กันไว้ — ปลอม header ให้ตรงไม่ได้ จึงยัง
 * ป้องกัน CSRF ได้แม้ sameSite จะเป็น 'none' แล้วก็ตาม
 *
 * Mount แบบ global ใน app.js (หลัง cookieParser) — ไม่ต้องไปแก้ทุก route
 * ทีละไฟล์ เช็คเฉพาะ method ที่เปลี่ยนแปลงข้อมูล (ไม่แตะ GET/HEAD/OPTIONS)
 * และเฉพาะตอนที่มี cookie `token` อยู่แล้ว (มี session ให้ป้องกัน) ถ้ายัง
 * ไม่ login เลย (เช่นตอนยิง POST /auth/login ครั้งแรก) จะปล่อยผ่านไปให้
 * downstream (`authenticate` middleware หรือ controller) จัดการแทน
 */

const jwt = require('jsonwebtoken');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const verifyCsrf = (req, res, next) => {
  if (SAFE_METHODS.includes(req.method)) return next();

  const token = req.cookies?.token;
  if (!token) return next(); // ไม่มี session ให้ป้องกัน — ปล่อยผ่าน (เช่น login/register)

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(); // token หมดอายุ/ไม่ถูกต้อง — ให้ authenticate() เป็นคน 401 แทน ไม่ใช่หน้าที่ CSRF check
  }

  const headerToken = req.headers['x-csrf-token'];
  if (!decoded.csrf || headerToken !== decoded.csrf) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token ไม่ถูกต้องหรือขาดหาย กรุณารีเฟรชหน้าแล้วลองใหม่',
    });
  }

  next();
};

module.exports = verifyCsrf;