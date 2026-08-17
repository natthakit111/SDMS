/**
 * utils/response.js
 * Standardized JSON response helpers for all controllers.
 */

const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const sendCreated = (res, data = null, message = 'Created successfully') => {
  return sendSuccess(res, data, message, 201);
};

// ⚠️ ใหม่: เพิ่ม code (optional) ต่อท้าย — ของเดิมที่เรียกแบบ 3 arguments
// เดิมยังทำงานปกติ ไม่พัง เพราะ code จะเป็น null เฉยๆ ถ้าไม่ส่งมา
const sendError = (res, message = 'Internal Server Error', statusCode = 500, errors = null, code = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  if (code) payload.code = code;
  return res.status(statusCode).json(payload);
};

const sendNotFound = (res, message = 'Resource not found', code = null) => {
  return sendError(res, message, 404, null, code);
};

const sendUnauthorized = (res, message = 'Unauthorized', code = null) => {
  return sendError(res, message, 401, null, code);
};

const sendForbidden = (res, message = 'Forbidden: insufficient permissions', code = null) => {
  return sendError(res, message, 403, null, code);
};

const sendBadRequest = (res, message = 'Bad request', errors = null, code = null) => {
  return sendError(res, message, 400, errors, code);
};

module.exports = {
  sendSuccess,
  sendCreated,
  sendError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendBadRequest,
};