/**
 * routes/maintenance.routes.js
 * Specific paths (/my, /stats) BEFORE wildcard (/:id)
 */
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/maintenanceController');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { uploadMeterImage } = require('../middlewares/upload.middleware');

const createValidation = [
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('description').trim().isLength({ min: 10 }),
  body('priority').optional().isIn(['low', 'medium', 'high']),
];

// ── Specific paths FIRST ──────────────────────────────────────
router.get('/my',
  authenticate, authorizeRoles('tenant'),
  ctrl.getMyRequests
);
router.get('/stats',
  authenticate, authorizeRoles('admin'),
  ctrl.getStats
);
router.post('/',
  authenticate, authorizeRoles('tenant'),
  uploadMeterImage,
  createValidation,
  ctrl.createRequest
);
router.get('/',
  authenticate, authorizeRoles('admin'),
  ctrl.getAllRequests
);

// ── Wildcard paths LAST ───────────────────────────────────────
router.get('/:id',
  authenticate,
  ctrl.getRequestById
);
router.put('/:id/status',
  authenticate, authorizeRoles('admin'),
  ctrl.updateStatus
);
router.put('/:id/cancel',
  authenticate, authorizeRoles('tenant'),
  ctrl.cancelRequest
);

module.exports = router;
