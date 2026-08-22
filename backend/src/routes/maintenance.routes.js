/**
 * routes/maintenance.routes.js
 * Specific paths (/my, /stats) BEFORE wildcard (/:id)
 */
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/maintenance.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { uploadMeterImage } = require('../middlewares/upload.middleware');
const { paginationValidation } = require('../utils/pagination');

const createValidation = [
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('description').trim().isLength({ min: 10 }),
  body('priority').optional().isIn(['low', 'medium', 'high']),
];

const updateStatusValidation = [
  body('status').isIn(['pending', 'in_progress', 'resolved', 'cancelled'])
    .withMessage('Status must be one of: pending, in_progress, resolved, cancelled'),
  body('admin_note').optional().trim().isLength({ max: 1000 }),
  body('assigned_to').optional({ nullable: true }).isInt({ min: 1 })
    .withMessage('assigned_to ต้องเป็น user_id ของแอดมิน (ตัวเลข)'),
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
router.get('/admins',
  authenticate, authorizeRoles('admin'),
  ctrl.getAssignableAdmins
);
router.post('/',
  authenticate, authorizeRoles('tenant'),
  uploadMeterImage,
  createValidation,
  ctrl.createRequest
);
router.get('/',
  authenticate, authorizeRoles('admin'),
  paginationValidation,
  ctrl.getAllRequests
);

// ── Wildcard paths LAST ───────────────────────────────────────
router.get('/:id',
  authenticate,
  ctrl.getRequestById
);
router.put('/:id/status',
  authenticate, authorizeRoles('admin'),
  updateStatusValidation,
  ctrl.updateStatus
);
router.put('/:id/cancel',
  authenticate, authorizeRoles('tenant'),
  ctrl.cancelRequest
);

module.exports = router;
