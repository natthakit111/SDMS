/**
 * routes/bill.routes.js
 * IMPORTANT: specific paths (/my, /generate, /report/monthly)
 * must be defined BEFORE wildcard paths (/:id) to avoid Express
 * matching them as an id parameter.
 */
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/billController');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

const generateBillValidation = [
  body('room_id').isInt({ min: 1 }),
  body('month').isInt({ min: 1, max: 12 }),
  body('year').isInt({ min: 2000 }),
  body('other_amount').optional().isFloat({ min: 0 }),
  body('due_date').optional().isDate(),
];

// ── Specific paths FIRST ──────────────────────────────────────
router.get('/my',
  authenticate, authorizeRoles('tenant'),
  ctrl.getMyBills
);
router.get('/report/monthly',
  authenticate, authorizeRoles('admin'),
  ctrl.getMonthlyReport
);
router.post('/generate',
  authenticate, authorizeRoles('admin'),
  generateBillValidation,
  ctrl.generateBill
);

// ── Admin list ────────────────────────────────────────────────
router.get('/',
  authenticate, authorizeRoles('admin'),
  ctrl.getAllBills
);

router.get('/available-rooms', 
  authenticate, authorizeRoles('admin'), 
  ctrl.getAvailableRoomsForBilling
);

// ── Wildcard paths LAST ───────────────────────────────────────
router.get('/:id/qr',
  authenticate,
  ctrl.getBillQR
);
router.get('/:id/invoice-pdf',
  authenticate,
  ctrl.exportBillInvoice
);
router.get('/:id',
  authenticate,
  ctrl.getBillById
);
router.put('/:id/cancel',
  authenticate, authorizeRoles('admin'),
  ctrl.cancelBill
);


module.exports = router;