/**
 * routes/announcement.routes.js
 * Base path: /api/announcements
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/announcementController');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

const createValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('content').trim().notEmpty().withMessage('Content is required'),
  body('target_audience').optional().isIn(['all', 'admin', 'tenant']),
  body('expires_at').optional().isISO8601(),
];

// Any authenticated user can read announcements
router.get('/',    authenticate, ctrl.getAll);
router.get('/:id', authenticate, ctrl.getById);

// Admin only — create / edit / delete
router.post('/',    authenticate, authorizeRoles('admin'), createValidation, ctrl.create);
router.put('/:id',  authenticate, authorizeRoles('admin'), ctrl.update);
router.delete('/:id', authenticate, authorizeRoles('admin'), ctrl.remove);

module.exports = router;
