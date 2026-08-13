/**
 * middlewares/errorHandler.js
 * Global Express error handler — catches any error passed via next(err).
 * Must be registered LAST in app.js (after all routes).
 */

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err);

  // MySQL duplicate entry (ER_DUP_ENTRY)
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry: a record with this value already exists.',
    });
  }

  // MySQL foreign key constraint (ER_NO_REFERENCED_ROW_2)
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist.',
    });
  }

  // JWT errors (should normally be caught in auth middleware, safety net here)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }

// Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: `File too large. Maximum allowed size is ${process.env.MAX_FILE_SIZE_MB || 5}MB.`,
    });
  }

  // ⚠️ ใหม่: ไฟล์ประเภทที่ไม่รองรับ (จาก upload.middleware.js fileFilter)
  // ต้องมี case แยก ไม่งั้นจะตกไป default branch ที่ซ่อน message จริงตอน
  // production (เพราะ statusCode 400 แต่ NODE_ENV=production จะโชว์แค่
  // "Internal Server Error" ทั้งที่เป็น validation error ที่ user ควรเห็น)
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message,
    });
  }

  // Default: 500 Internal Server Error
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';

  return res.status(statusCode).json({ success: false, message });
};

module.exports = errorHandler;
