const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/depositController');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

router.use(authenticate);
router.get('/', authorizeRoles('admin'), ctrl.getAll);
router.put('/:contract_id/refund', authorizeRoles('admin'), ctrl.refund);

module.exports = router;