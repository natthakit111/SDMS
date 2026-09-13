/**
 * routes/contract.routes.js
 * Specific paths BEFORE wildcard /:id
 * Frontend calls /my/active — added as alias for /my
 */
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/contract.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { uploadContractFile: uploadContractMiddleware } = require('../middlewares/upload.middleware');
const { paginationValidation } = require('../utils/pagination');
const { isValidThaiIdChecksum, isValidPassportFormat } = require('../utils/idValidation');

const createContractValidation = [
  body('tenant_id').isInt({ min: 1 }),
  body('room_id').isInt({ min: 1 }),
  body('start_date').isDate(),
  body('end_date').isDate(),
  body('deposit_amount').optional().isFloat({ min: 0 }),
  body('rent_amount').optional().isFloat({ min: 0 }),

  body('tenant_id_type')
    .optional()
    .trim()
    .isIn(['thai_id', 'passport']).withMessage('ID_TYPE_INVALID'),

  // ⚠️ เดิมช่องนี้ไม่มี validation เลยฝั่ง backend (แค่เช็คซ้ำกับผู้เช่าอื่น)
  // ทั้งที่ค่าที่กรอกตรงนี้ถูกเขียนทับไปที่ tenants.id_card_number จริง (ดู
  // contract.controller.js createContract) — ใช้กฎเดียวกับ tenant.routes.js
  // เพื่อไม่ให้มีทางลัดผ่าน validation ของเลขบัตร/พาสปอร์ตออกไปทางนี้
  body('tenant_id_card')
    .optional()
    .trim()
    .customSanitizer((val) => val.replace(/-/g, '').toUpperCase())
    .notEmpty().withMessage('ID_CARD_LENGTH')
    .bail()
    .custom((value, { req }) => {
      if (req.body.tenant_id_type === 'passport') {
        if (!isValidPassportFormat(value)) throw new Error('PASSPORT_FORMAT');
        return true;
      }
      if (!/^\d{13}$/.test(value)) {
        throw new Error(/^\d*$/.test(value) ? 'ID_CARD_LENGTH' : 'ID_CARD_FORMAT');
      }
      if (!isValidThaiIdChecksum(value)) throw new Error('ID_CARD_CHECKSUM_INVALID');
      return true;
    }),
];

const updateValidation = [
  body('end_date').optional().isDate(),
  body('rent_amount').optional().isFloat({ min: 0 }),
];

const renewValidation = [
  body('end_date').isDate(),
  body('rent_amount').optional().isFloat({ min: 0 }),
];

// ── Upload config for contract files (PDF / Word) ─────────────




router.use(authenticate);

// ── Tenant self-service — BEFORE /:id ────────────────────────
// Support both /my and /my/active (frontend calls /my/active)
router.get('/my',        authorizeRoles('tenant'), ctrl.getMyContract);
router.get('/my/active', authorizeRoles('tenant'), ctrl.getMyContract); // alias

// ── Admin list ────────────────────────────────────────────────
router.get('/',   authorizeRoles('admin'), paginationValidation, ctrl.getAllContracts);
router.post('/',  authorizeRoles('admin'), createContractValidation, ctrl.createContract);

// ── Wildcard paths LAST ───────────────────────────────────────
router.get('/:id',              ctrl.getContractById);
router.put('/:id',              authorizeRoles('admin'), updateValidation, ctrl.updateContract);
router.put('/:id/renew',        authorizeRoles('admin'), renewValidation, ctrl.renewContract);
router.put('/:id/terminate',    authorizeRoles('admin'), ctrl.terminateContract);

// ── Contract file upload/download ──────────────────────────────
router.post('/:id/upload', authorizeRoles('admin'), uploadContractMiddleware, ctrl.uploadContractFile);
router.get('/:id/file',    ctrl.downloadContractFile); // สิทธิ์เจ้าของเช็คในตัว controller

module.exports = router;