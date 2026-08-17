/**
 * routes/settings.routes.js
 * Base path: /api/settings
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const router  = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { sendSuccess, sendBadRequest } = require('../utils/response');
const SettingsModel = require('../models/settings.model');

// ── Validation ───────────────────────────────────────────────
const updateValidation = [
  body('dorm_name').optional().trim().isLength({ max: 200 }),
  body('dorm_address').optional().trim().isLength({ max: 500 }),
  body('admin_email').optional({ checkFalsy: true }).isEmail().withMessage('EMAIL_FORMAT'),
  body('admin_phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),

  // เลขประจำตัวผู้เสียภาษี — แสดงบนใบแจ้งหนี้/ใบเสร็จ (เดิมอ่านจาก
  // process.env.COMPANY_TAX_ID ตรงๆ ใน billController, ย้ายมาตั้งค่าผ่าน
  // หน้า Settings แทน เพื่อให้ใช้ได้กับหอพักไหนก็ได้โดยไม่ต้อง redeploy)
  body('company_tax_id')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer((val) => val.replace(/[-\s]/g, ''))
    .matches(/^\d{10}$|^\d{13}$/)
    .withMessage('COMPANY_TAX_ID_FORMAT'),

  body('currency').optional().trim().isLength({ max: 10 }),
  body('tax_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('TAX_RATE_RANGE'),

  body('promptpay_type')
    .optional()
    .isIn(['phone', 'citizen_id'])
    .withMessage('PROMPTPAY_TYPE_INVALID'),

  body('promptpay_id')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer((val) => val.replace(/[-\s]/g, ''))
    .custom((val, { req }) => {
      const type = req.body.promptpay_type;
      if (type === 'phone' && !/^0\d{9}$/.test(val)) {
        throw new Error('PROMPTPAY_PHONE_FORMAT');
      }
      if (type === 'citizen_id' && !/^\d{13}$/.test(val)) {
        throw new Error('PROMPTPAY_CITIZENID_FORMAT');
      }
      if (!type && !/^0\d{9}$/.test(val) && !/^\d{13}$/.test(val)) {
        throw new Error('PROMPTPAY_ID_FORMAT');
      }
      return true;
    }),

  body('bank_name').optional().trim().isLength({ max: 100 }),
  body('bank_account')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer((val) => val.replace(/[-\s]/g, ''))
    .matches(/^\d{5,20}$/)
    .withMessage('BANK_ACCOUNT_FORMAT'),
  body('bank_account_name').optional().trim().isLength({ max: 100 }),

  body('notify_payment').optional().isIn(['0', '1']),
  body('notify_maintenance').optional().isIn(['0', '1']),
  body('notify_overdue').optional().isIn(['0', '1']),

  body('water_billing_type').optional().isIn(['unit', 'flat']),
  body('water_flat_rate')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('WATER_FLAT_RATE_RANGE'),
];

// ── GET /api/settings ────────────────────────────────────────
router.get('/', authenticate, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const settings = await SettingsModel.getAll();
    return sendSuccess(res, settings);
  } catch (err) { next(err); }
});

// ── PUT /api/settings ───────────────────────────────────────
router.put('/', authenticate, authorizeRoles('admin'), updateValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'VALIDATION_FAILED', errors.array());

    const allowed = [
      'dorm_name', 'dorm_address', 'admin_email', 'admin_phone',
      'num_floors',
      'company_tax_id',
      'currency', 'tax_rate',
      'bank_name', 'bank_account', 'bank_account_name',
      'promptpay_type', 'promptpay_id',
      'notify_payment', 'notify_maintenance', 'notify_overdue',
      'water_billing_type',
      'water_flat_rate',
    ];

    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
    if (updates.length === 0) return sendBadRequest(res, 'NO_VALID_FIELDS');

    const keysToUpdate = updates.map(([k]) => k);
    const oldValues = await SettingsModel.getByKeys(keysToUpdate);

    for (const [key, value] of updates) {
      await SettingsModel.upsertWithAudit(req.user.user_id, key, value, oldValues[key]);
    }

    const settings = await SettingsModel.getAll();
    return sendSuccess(res, settings, 'SETTINGS_UPDATED');
  } catch (err) { next(err); }
});

// ── GET /api/settings/audit-log ──
router.get('/audit-log', authenticate, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const { setting_key, limit } = req.query;
    const rows = await SettingsModel.getAuditLog({ settingKey: setting_key, limit });
    return sendSuccess(res, rows);
  } catch (err) { next(err); }
});

module.exports = router;