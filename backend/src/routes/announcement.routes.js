/**
 * routes/announcement.routes.js
 * Base path: /api/announcements
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/announcement.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

const createValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('content').trim().notEmpty().withMessage('Content is required'),
  body('target_audience').optional().isIn(['all', 'admin', 'tenant']),
  body('expires_at').optional().isISO8601(),
];

// ⚠️ ใหม่: เดิม PUT /:id ไม่มี validator เลย — เพิ่มโดยใช้ .optional()
// ทุก field เพราะเป็น partial update (ผู้ใช้อาจส่งมาแค่บาง field)
// ต่างจาก createValidation ที่ title/content บังคับ required

// ⚠️ สร้างเป็น array ใหม่แยกต่างหาก ไม่ derive จาก createValidation ด้วย
// .map(v => v.optional()) เด็ดขาด — ValidationChain เป็น mutable object,
// .optional() จะแก้ไข object ต้นทางเดิมไปด้วย ทำให้ createValidation ที่
// POST ใช้อยู่กลายเป็น optional ตามไปด้วยโดยไม่ตั้งใจ (บั๊กแบบเดียวกับที่
// เจอใน room.routes.js มาก่อน)
const updateValidation = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('content').optional().trim().notEmpty().withMessage('Content cannot be empty'),
  body('target_audience').optional().isIn(['all', 'admin', 'tenant']),
  body('target_floor').optional({ nullable: true }).isInt({ min: 1 }).withMessage('target_floor must be a positive integer'),
  body('is_pinned').optional().isBoolean(),
  body('is_urgent').optional().isBoolean(),
  body('expires_at').optional({ nullable: true }).isISO8601(),
];

// Any authenticated user can read announcements
router.get('/',    authenticate, ctrl.getAll);
router.get('/:id', authenticate, ctrl.getById);

// Admin only — create / edit / delete
router.post('/',    authenticate, authorizeRoles('admin'), createValidation, ctrl.create);
router.put('/:id',  authenticate, authorizeRoles('admin'), updateValidation, ctrl.update);
router.delete('/:id', authenticate, authorizeRoles('admin'), ctrl.remove);

module.exports = router;
