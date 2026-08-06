/**
 * routes/tenant.routes.js
 * Base path: /api/tenants
 *
 * หมายเหตุ: withMessage() ใช้ "error code" (SCREAMING_SNAKE_CASE) แทนข้อความสำเร็จรูป
 * เพื่อให้ frontend แปลเป็นภาษาที่ผู้ใช้เลือกไว้ (TH/EN) ผ่านระบบ t() ที่มีอยู่แล้ว
 * ห้ามใส่ข้อความภาษาใดภาษาหนึ่งตรงๆ ที่นี่ เพราะ backend ไม่รู้ว่า user เลือกภาษาอะไร
 *
 * NOTE: ตัด validation ของ `username` ออกแล้ว — ระบบ auto-generate username
 * จาก phone เสมอ (ให้สอดคล้องกับ flow self-register ที่ authController.register
 * ทำอยู่แล้ว) แอดมินไม่ต้องกรอก/เห็นช่องนี้อีกต่อไป
 */
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/tenantController');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const notificationPrefController = require('../controllers/notificationPreference.controller')

// เบอร์โทรไทย: ขึ้นต้นด้วย 0, ตามด้วย 1-9, รวม 9-10 หลัก (รองรับทั้งมือถือและเบอร์บ้าน)
const THAI_PHONE_REGEX = /^0[1-9]\d{7,8}$/;

const createValidation = [
  body('password').isLength({ min: 6 }).withMessage('PASSWORD_MIN_LENGTH'),

  body('first_name').trim().notEmpty().withMessage('FIRST_NAME_REQUIRED')
    .bail().isLength({ max: 100 }).withMessage('FIRST_NAME_TOO_LONG'),
  body('last_name').trim().notEmpty().withMessage('LAST_NAME_REQUIRED')
    .bail().isLength({ max: 100 }).withMessage('LAST_NAME_TOO_LONG'),

  body('id_card_number')
    .trim()
    .customSanitizer((val) => val.replace(/-/g, ''))
    .isLength({ min: 13, max: 13 }).withMessage('ID_CARD_LENGTH')
    .bail()
    .isNumeric().withMessage('ID_CARD_FORMAT'),

  body('phone')
    .trim()
    .customSanitizer((val) => val.replace(/[\s-]/g, ''))
    .notEmpty().withMessage('PHONE_REQUIRED')
    .bail()
    .matches(THAI_PHONE_REGEX)
    .withMessage('PHONE_FORMAT'),

  body('email').optional({ checkFalsy: true }).isEmail().withMessage('EMAIL_FORMAT'),

  body('emergency_contact_name')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 }).withMessage('EMERGENCY_NAME_TOO_LONG'),

  body('emergency_contact_phone')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer((val) => val.replace(/[\s-]/g, ''))
    .matches(THAI_PHONE_REGEX)
    .withMessage('EMERGENCY_PHONE_FORMAT'),
];

const updateValidation = [
  body('first_name').optional().trim().notEmpty().withMessage('FIRST_NAME_REQUIRED')
    .bail().isLength({ max: 100 }).withMessage('FIRST_NAME_TOO_LONG'),
  body('last_name').optional().trim().notEmpty().withMessage('LAST_NAME_REQUIRED')
    .bail().isLength({ max: 100 }).withMessage('LAST_NAME_TOO_LONG'),

  body('phone')
    .optional()
    .trim()
    .customSanitizer((val) => val.replace(/[\s-]/g, ''))
    .notEmpty().withMessage('PHONE_REQUIRED')
    .bail()
    .matches(THAI_PHONE_REGEX)
    .withMessage('PHONE_FORMAT'),

  body('email').optional({ checkFalsy: true }).isEmail().withMessage('EMAIL_FORMAT'),

  body('emergency_contact_name')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 }).withMessage('EMERGENCY_NAME_TOO_LONG'),

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
router.get('/notification-preferences', authenticate, authorizeRoles('tenant'), notificationPrefController.getPreferences);
router.put('/notification-preferences', authenticate, authorizeRoles('tenant'), notificationPrefController.updatePreferences);

// Admin routes
router.get('/',       authenticate, authorizeRoles('admin'), ctrl.getAllTenants);
router.get('/:id',    authenticate, authorizeRoles('admin'), ctrl.getTenantById);
router.post('/',      authenticate, authorizeRoles('admin'), createValidation, ctrl.createTenant);
router.put('/:id',    authenticate, authorizeRoles('admin'), updateValidation, ctrl.updateTenant);
router.delete('/:id', authenticate, authorizeRoles('admin'), ctrl.deleteTenant);

module.exports = router;