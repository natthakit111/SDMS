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

const createContractValidation = [
  body('tenant_id').isInt({ min: 1 }),
  body('room_id').isInt({ min: 1 }),
  body('start_date').isDate(),
  body('end_date').isDate(),
  body('deposit_amount').optional().isFloat({ min: 0 }),
  body('rent_amount').optional().isFloat({ min: 0 }),
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
router.get('/',   authorizeRoles('admin'), ctrl.getAllContracts);
router.post('/',  authorizeRoles('admin'), createContractValidation, ctrl.createContract);

// ── Wildcard paths LAST ───────────────────────────────────────
router.get('/:id',              ctrl.getContractById);
router.put('/:id',              authorizeRoles('admin'), updateValidation, ctrl.updateContract);
router.put('/:id/renew',        authorizeRoles('admin'), renewValidation, ctrl.renewContract);
router.put('/:id/terminate',    authorizeRoles('admin', 'tenant'), ctrl.terminateContract);

// ── Contract file upload/download ──────────────────────────────
router.post('/:id/upload', authorizeRoles('admin'), uploadContractMiddleware, ctrl.uploadContractFile);
router.get('/:id/file',    ctrl.downloadContractFile); // สิทธิ์เจ้าของเช็คในตัว controller

module.exports = router;