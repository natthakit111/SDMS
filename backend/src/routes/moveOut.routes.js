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

const createValidation = [
  body('move_out_date').isDate().withMessage('วันที่ต้องการย้ายออกไม่ถูกต้อง'),
  body('reason').trim().notEmpty().withMessage('กรุณากรอกเหตุผลในการย้ายออก'),
];

const approveValidation = [
  body('actual_checkout_date').optional().isDate().withMessage('วันที่ย้ายออกจริงไม่ถูกต้อง'),
  body('deduction_extra').optional().isFloat({ min: 0 }),
];

// Tenant: ดูของตัวเอง + ส่ง request ใหม่
router.get('/',    authenticate, ctrl.getAll);
router.post('/',   authenticate, authorizeRoles('tenant'), createValidation, ctrl.create);

// Admin: พรีวิวยอดคืนเงินประกันก่อนอนุมัติ (ต้องอยู่เหนือ /:id/approve ไม่งั้นชนกัน — จริง ๆ ไม่ชนเพราะ path ต่างกัน แต่วางไว้ใกล้กันให้อ่านง่าย)
router.get('/:id/deposit-preview', authenticate, authorizeRoles('admin'), ctrl.getDepositPreview);

// Admin: อนุมัติ / ปฏิเสธ
router.put('/:id/approve', authenticate, authorizeRoles('admin'), approveValidation, ctrl.approve);
router.put('/:id/reject',  authenticate, authorizeRoles('admin'), ctrl.reject);

module.exports = router;