/**
 * routes/room.routes.js  —  Base: /api/rooms
 */
const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/roomController');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

const roomValidation = [
  body('room_number').trim().notEmpty().withMessage('Room number is required'),
  body('floor').isInt({ min: 1 }).withMessage('Floor must be a positive integer'),
  body('room_type').trim().notEmpty().withMessage('Room type is required'),
  body('base_rent').isFloat({ min: 0 }).withMessage('Base rent must be a positive number'),
  body('area_sqm').optional().isFloat({ min: 0 }),
];

// All routes require authentication
router.use(authenticate);

router.get('/stats', ctrl.getRoomStats);          // dashboard widget
router.get('/',      ctrl.getAllRooms);            // ?status=available
router.get('/:id',   ctrl.getRoomById);

// Admin-only mutations
router.post('/',    authorizeRoles('admin'), roomValidation,                   ctrl.createRoom);
router.put('/:id',  authorizeRoles('admin'), roomValidation.map(v => v.optional()), ctrl.updateRoom);
router.delete('/:id', authorizeRoles('admin'), ctrl.deleteRoom);

module.exports = router;
