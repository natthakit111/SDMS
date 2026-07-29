/**
 * routes/moveOut.routes.js
 * Base path: /api/move-out
 */
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/moveOutController');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

// หมายเหตุ: เดิม reason บังคับความยาวขั้นต่ำ 5 ตัวอักษร ตัดออกแล้ว
// เพราะเหตุผลสั้น ๆ ที่ชัดเจน (เช่น "ย้ายกลับบ้าน") ก็ควรผ่านได้
// เหลือแค่บังคับห้ามเว้นว่าง — ถ้าเหตุผลดูไม่สมเหตุสมผล admin ปฏิเสธคำร้องได้อยู่แล้วตอนอนุมัติ
const createValidation = [
  body('move_out_date').isDate().withMessage('วันที่ต้องการย้ายออกไม่ถูกต้อง'),
  body('reason').trim().notEmpty().withMessage('กรุณากรอกเหตุผลในการย้ายออก'),
];

// Tenant: ดูของตัวเอง + ส่ง request ใหม่
router.get('/',    authenticate, ctrl.getAll);
router.post('/',   authenticate, authorizeRoles('tenant'), createValidation, ctrl.create);

// Admin: อนุมัติ / ปฏิเสธ
router.put('/:id/approve', authenticate, authorizeRoles('admin'), ctrl.approve);
router.put('/:id/reject',  authenticate, authorizeRoles('admin'), ctrl.reject);

module.exports = router;