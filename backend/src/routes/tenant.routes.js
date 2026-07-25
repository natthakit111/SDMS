/**
 * routes/tenant.routes.js
 * Base path: /api/tenants
 *
 * หมายเหตุ: withMessage() ใช้ "error code" (SCREAMING_SNAKE_CASE) แทนข้อความสำเร็จรูป
 * เพื่อให้ frontend แปลเป็นภาษาที่ผู้ใช้เลือกไว้ (TH/EN) ผ่านระบบ t() ที่มีอยู่แล้ว
 * ห้ามใส่ข้อความภาษาใดภาษาหนึ่งตรงๆ ที่นี่ เพราะ backend ไม่รู้ว่า user เลือกภาษาอะไร
 */
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/tenantController');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

// เบอร์โทรไทย: ขึ้นต้นด้วย 0, ตามด้วย 1-9, รวม 9-10 หลัก (รองรับทั้งมือถือและเบอร์บ้าน)
const THAI_PHONE_REGEX = /^0[1-9]\d{7,8}$/;

const createValidation = [
  body('username')
    .trim().isLength({ min: 3, max: 50 }).withMessage('USERNAME_LENGTH')
    .bail()
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('USERNAME_FORMAT'),

  body('password').isLength({ min: 6 }).withMessage('PASSWORD_MIN_LENGTH'),

  body('first_name').trim().notEmpty().withMessage('FIRST_NAME_REQUIRED'),
  body('last_name').trim().notEmpty().withMessage('LAST_NAME_REQUIRED'),

  body('id_card_number')
    .trim()
    .customSanitizer((val) => val.replace(/-/g, ''))
    .isLength({ min: 13, max: 13 })
    .withMessage('ID_CARD_LENGTH'),

  body('phone')
    .trim()
    .customSanitizer((val) => val.replace(/[\s-]/g, ''))
    .notEmpty().withMessage('PHONE_REQUIRED')
    .bail()
    .matches(THAI_PHONE_REGEX)
    .withMessage('PHONE_FORMAT'),

  body('email').optional().isEmail().withMessage('EMAIL_FORMAT'),

  body('emergency_contact_phone')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer((val) => val.replace(/[\s-]/g, ''))
    .matches(THAI_PHONE_REGEX)
    .withMessage('EMERGENCY_PHONE_FORMAT'),
];

const updateValidation = [
  body('phone')
    .optional()
    .trim()
    .customSanitizer((val) => val.replace(/[\s-]/g, ''))
    .notEmpty().withMessage('PHONE_REQUIRED')
    .bail()
    .matches(THAI_PHONE_REGEX)
    .withMessage('PHONE_FORMAT'),

  body('email').optional().isEmail().withMessage('EMAIL_FORMAT'),

  body('emergency_contact_phone')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer((val) => val.replace(/[\s-]/g, ''))
    .matches(THAI_PHONE_REGEX)
    .withMessage('EMERGENCY_PHONE_FORMAT'),
];

// Tenant self-service (must come BEFORE /:id to avoid route conflict)
router.get('/me/profile',   authenticate, authorizeRoles('tenant'), ctrl.getMyProfile);
router.put('/me/profile',   authenticate, authorizeRoles('tenant'), ctrl.updateMyProfile);

// Admin routes
router.get('/',       authenticate, authorizeRoles('admin'), ctrl.getAllTenants);
router.get('/:id',    authenticate, authorizeRoles('admin'), ctrl.getTenantById);
router.post('/',      authenticate, authorizeRoles('admin'), createValidation, ctrl.createTenant);
router.put('/:id',    authenticate, authorizeRoles('admin'), updateValidation, ctrl.updateTenant);
router.delete('/:id', authenticate, authorizeRoles('admin'), ctrl.deleteTenant);

module.exports = router;