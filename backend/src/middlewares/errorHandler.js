/**
 * middlewares/errorHandler.js
 * Global Express error handler — catches any error passed via next(err).
 * Must be registered LAST in app.js (after all routes).
 */

// ⚠️ FIX: เดิมทุก branch ข้างล่างนี้ตอบกลับเป็นประโยคภาษาอังกฤษ (หรือบาง
// จุดภาษาไทย) ฝังตรงๆ ไม่ผ่านระบบแปลภาษาของ frontend เลย (frontend แปล
// เฉพาะ message ที่เป็น CODE ตัวพิมพ์ใหญ่ล้วนอย่าง 'PHONE_ALREADY_REGISTERED'
// ผ่าน errors.* ใน language-context.tsx) ทำให้ user ที่ตั้งภาษาไทยไว้เจอ
// error เป็นภาษาอังกฤษกลางดัน (เช่นตอนกรอกข้อมูลซ้ำ) เปลี่ยนทุก branch ให้
// ส่ง CODE แทน ให้ axiosInstance.js แปลให้ตรงกับภาษาที่ผู้ใช้เลือกไว้เสมอ
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err);

  // MySQL duplicate entry (ER_DUP_ENTRY)
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'DUPLICATE_ENTRY' });
  }

  // MySQL foreign key constraint (ER_NO_REFERENCED_ROW_2)
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ success: false, message: 'REFERENCED_RECORD_NOT_FOUND' });
  }

  // JWT errors (should normally be caught in auth middleware, safety net here)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'INVALID_OR_EXPIRED_TOKEN' });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'FILE_TOO_LARGE',
      maxSizeMB: Number(process.env.MAX_FILE_SIZE_MB) || 5,
    });
  }

  // ไฟล์ประเภทที่ไม่รองรับ (จาก upload.middleware.js fileFilter) — ต้องมี
  // case แยก ไม่งั้นจะตกไป default branch ที่ซ่อน message จริงตอน production
  // (เพราะ statusCode 400 แต่ NODE_ENV=production จะโชว์แค่ 'INTERNAL_ERROR'
  // ทั้งที่เป็น validation error ที่ user ควรเห็น)
  if (err.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: 'UNSUPPORTED_FILE_TYPE',
      allowedFormats: err.allowedFormats,
    });
  }

  // Default: 500 Internal Server Error
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' || !err.message
      ? 'INTERNAL_ERROR'
      : err.message;

  return res.status(statusCode).json({ success: false, message });
};

module.exports = errorHandler;
