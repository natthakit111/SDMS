/**
 * routes/meter.routes.js
 * Base path: /api/meters
 * Admin only — tenants cannot record or edit meter readings.
 */

const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/meterController');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { uploadMeterImage } = require('../middlewares/upload.middleware');

const readingValidation = [
  body('room_id').isInt({ min: 1 }).withMessage('Valid room_id is required'),
  body('meter_type').isIn(['electric', 'water']).withMessage('meter_type must be electric or water'),
  body('reading_month').isInt({ min: 1, max: 12 }).withMessage('reading_month must be 1–12'),
  body('reading_year').isInt({ min: 2000 }).withMessage('reading_year is invalid'),
  body('current_unit').isFloat({ min: 0 }).withMessage('current_unit must be >= 0'),
  body('rate_per_unit').optional().isFloat({ min: 0 }),
];

router.get('/',
  authenticate, authorizeRoles('admin'),
  ctrl.getAllReadings
);

router.get('/rooms/:roomId/previous',
  authenticate,
  ctrl.getPreviousReading
);

router.get('/:id',
  authenticate, authorizeRoles('admin'),
  ctrl.getReadingById
);

router.post('/',
  authenticate, authorizeRoles('admin'),
  uploadMeterImage,        // handles multipart/form-data + saves file
  readingValidation,
  ctrl.createReading
);

router.put('/:id',
  authenticate, authorizeRoles('admin'),
  uploadMeterImage,
  ctrl.updateReading
);

module.exports = router;
