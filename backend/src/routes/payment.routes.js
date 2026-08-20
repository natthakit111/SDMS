/**
 * routes/payment.routes.js
 * Specific paths (/my) BEFORE wildcard (/:id)
 */
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/payment.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { uploadPaymentSlip } = require('../middlewares/upload.middleware');

const submitValidation = [
  body('bill_id').isInt({ min: 1 }),
  body('payment_method').optional().isIn(['qr_promptpay', 'cash', 'bank_transfer']),
];

// ── Specific paths FIRST ──────────────────────────────────────
router.get('/my',
  authenticate, authorizeRoles('tenant'),
  ctrl.getMyPayments
);
router.post('/',
  authenticate, authorizeRoles('tenant'),
  uploadPaymentSlip,
  submitValidation,
  ctrl.submitPayment
);
router.get('/',
  authenticate, authorizeRoles('admin'),
  ctrl.getAllPayments
);

// ── Wildcard paths LAST ───────────────────────────────────────
router.get('/:id',
  authenticate,
  ctrl.getPaymentById
);
router.put('/:id/verify',
  authenticate, authorizeRoles('admin'),
  ctrl.verifyPayment
);
router.put('/:id/reject',
  authenticate, authorizeRoles('admin'),
  ctrl.rejectPayment
);

module.exports = router;
