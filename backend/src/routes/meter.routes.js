//src/routes/meter.routes.js

const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/meterController');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { uploadMeterImage } = require('../middlewares/upload.middleware');

const readingValidation = [
  body('room_id').isInt({ min: 1 }).withMessage('Valid room_id is required'),
  body('meter_type').isIn(['electric', 'water']).withMessage('meter_type must be electric or water'),
  body('reading_month').isInt({ min: 1, max: 12 }).withMessage('reading_month must be 1–12'),
  body('reading_year').isInt({ min: 2000 }).withMessage('reading_year is invalid'),
  body('current_unit').isFloat({ min: 0 }).withMessage('current_unit must be >= 0'),
  body('rate_per_unit').optional().isFloat({ min: 0 }),
];

// ⚠️ ใหม่: เดิม PUT /:id ไม่มี validator เลย — สร้างชุดแยกต่างหาก (ไม่ใช้
// readingValidation.map(v => v.optional()) เพราะ ValidationChain เป็น
// mutable object จะไปกระทบ readingValidation ต้นทางที่ POST ใช้อยู่)
const updateReadingValidation = [
  body('current_unit').optional().isFloat({ min: 0 }).withMessage('current_unit must be >= 0'),
  body('rate_per_unit').optional().isFloat({ min: 0 }).withMessage('rate_per_unit must be >= 0'),
];

router.get('/',
  authenticate, authorizeRoles('admin'),
  ctrl.getAllReadings
);

// ใหม่
// ⚠️ FIX: เดิมไม่จำกัด role — tenant คนไหนก็ไล่เลข roomId ดูมิเตอร์ล่าสุด
// ของห้องอื่นได้ทั้งที่ endpoint นี้มีไว้ auto-fill ฟอร์มตอน admin กรอก
// มิเตอร์ใหม่เท่านั้น
router.get('/rooms/:roomId/previous',
  authenticate, authorizeRoles('admin'),
  ctrl.getPreviousReading
);

// ── Specific path ต้องมาก่อน /:id เสมอ ──────────────────────────
router.get('/available-rooms',
  authenticate, authorizeRoles('admin'),
  ctrl.getAvailableRoomsForMeter
);

router.get('/:id',
  authenticate, authorizeRoles('admin'),
  ctrl.getReadingById
);

router.post('/',
  authenticate, authorizeRoles('admin'),
  uploadMeterImage,
  readingValidation,
  ctrl.createReading
);

router.put('/:id',
  authenticate, authorizeRoles('admin'),
  uploadMeterImage,
  updateReadingValidation,
  ctrl.updateReading
);

module.exports = router;