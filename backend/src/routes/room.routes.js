/**
 * routes/room.routes.js  —  Base: /api/rooms
 */
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/room.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

// ⚠️ FIX: ตัวแปรนี้เคยหายไปจากไฟล์ ทำให้ POST /rooms ไปใช้
// updateRoomValidation แทน (ทุก field optional) — request ที่ขาด field
// บังคับเลยหลุดผ่าน validator ไปถึง DB แล้วพังเป็น 500 แทนที่จะเป็น 400
// ที่ validator ควรดักไว้ก่อน — ใช้กับ POST (create) เท่านั้น ต้อง
// บังคับ field ที่จำเป็นให้ครบ
const roomValidation = [
  body('room_number').trim().notEmpty().withMessage('Room number is required'),
  body('floor').isInt({ min: 1 }).withMessage('Floor must be a positive integer'),
  body('room_type').trim().notEmpty().withMessage('Room type is required'),
  body('base_rent').isFloat({ min: 0 }).withMessage('Base rent must be a positive number'),
  body('area_sqm').optional().isFloat({ min: 0 }),
];

// ใช้กับ PUT (update) เท่านั้น — ทุก field optional เพราะเป็น partial update
// ⚠️ ห้ามสร้างด้วย roomValidation.map(v => v.optional()) เด็ดขาด เพราะ
// ValidationChain เป็น mutable object จะไป mutate roomValidation ต้นทาง
// ที่ POST ใช้อยู่ด้วย (บั๊กเดิมที่เคยเจอมาก่อน) ต้องสร้างเป็น array แยก
// ใหม่ทั้งหมดแบบนี้เสมอ
const updateRoomValidation = [
  body('room_number').optional().trim().notEmpty().withMessage('Room number is required'),
  body('floor').optional().isInt({ min: 1 }).withMessage('Floor must be a positive integer'),
  body('room_type').optional().trim().notEmpty().withMessage('Room type is required'),
  body('base_rent').optional().isFloat({ min: 0 }).withMessage('Base rent must be a positive number'),
  body('area_sqm').optional().isFloat({ min: 0 }),
];

// All routes require authentication
router.use(authenticate);

router.get('/stats', ctrl.getRoomStats);
router.get('/',      ctrl.getAllRooms);
router.get('/:id',   ctrl.getRoomById);

// Admin-only mutations
router.post('/',      authorizeRoles('admin'), roomValidation,       ctrl.createRoom);
router.put('/:id',    authorizeRoles('admin'), updateRoomValidation, ctrl.updateRoom);
router.delete('/:id', authorizeRoles('admin'), ctrl.deleteRoom);

module.exports = router;