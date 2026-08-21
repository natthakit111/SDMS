/**
 * utils/pagination.js
 * Helper ร่วมสำหรับ endpoint ที่ list ข้อมูลแบบแบ่งหน้า (page/limit)
 * ใช้คู่กับ express-validator query('page')/query('limit') ที่ประกาศไว้ที่ route
 */

const { query } = require('express-validator');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// แปลง req.query เป็น { page, limit, offset, isPaginated } ที่ปลอดภัยเสมอ
// (กัน limit ใหญ่เกินไปที่จะดึงทั้งตารางออกมาทีเดียว ต่อให้ query param
// ส่งมาแปลกๆ)
//
// ⚠️ isPaginated=false เมื่อไม่มีทั้ง page และ limit ใน query เลย — endpoint
// เดียวกันนี้ถูกเรียกจากที่อื่นด้วย (dashboard aggregation, dropdown เลือก
// ผู้เช่า/มิเตอร์ ฯลฯ) ที่ต้องการข้อมูลทั้งหมดแบบเดิม ไม่รู้จัก pagination
// เลย ถ้าบังคับ LIMIT เริ่มต้นเสมอจะไปตัดข้อมูลของจุดเหล่านั้นแบบเงียบๆ
// (เช่น dropdown เหลือแค่ 20 รายการแรก) — ต้อง opt-in ชัดเจนด้วยการส่ง
// page หรือ limit มาเองเท่านั้นถึงจะเปิด pagination จริง
const parsePagination = (reqQuery = {}) => {
  const isPaginated = reqQuery.page !== undefined || reqQuery.limit !== undefined;
  let page = parseInt(reqQuery.page, 10);
  let limit = parseInt(reqQuery.limit, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  const offset = (page - 1) * limit;
  return { page, limit: isPaginated ? limit : null, offset, isPaginated };
};

const buildPaginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / limit),
});

// ใช้ร่วมกับ route ที่รองรับ ?page=&limit= — validate เบื้องต้นก่อนเข้า
// controller (parsePagination ด้านบน clamp ค่าอยู่แล้ว แต่ validator ทำให้
// ส่งค่าผิดชนิด เช่น page=abc กลับเป็น 400 ที่ชัดเจนแทนที่จะเงียบๆ fallback)
const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('PAGE_INVALID'),
  query('limit').optional().isInt({ min: 1, max: MAX_LIMIT }).withMessage('LIMIT_INVALID'),
];

module.exports = { parsePagination, buildPaginationMeta, paginationValidation, DEFAULT_LIMIT, MAX_LIMIT };
