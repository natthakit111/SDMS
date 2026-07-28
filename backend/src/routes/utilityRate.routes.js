/**
 * routes/utilityRate.routes.js
 * /current must be BEFORE / to avoid being shadowed
 */
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const UtilityRateModel = require('../models/utilityRate.model');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { sendSuccess, sendCreated, sendBadRequest } = require('../utils/response');
const { validationResult } = require('express-validator');

const rateValidation = [
  body('utility_type').isIn(['electric', 'water']),
  body('rate_per_unit').isFloat({ min: 0.01 }),
  body('effective_from').isDate(),
];

// /current BEFORE / — prevents Express matching 'current' as an id
router.get('/current', authenticate, async (req, res, next) => {
  try {
    const [electric, water] = await Promise.all([
      UtilityRateModel.getCurrentRate('electric'),
      UtilityRateModel.getCurrentRate('water'),
    ]);
    return sendSuccess(res, { electric, water });
  } catch (err) { next(err); }
});

router.get('/', authenticate, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const rates = await UtilityRateModel.findAll();
    return sendSuccess(res, rates);
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorizeRoles('admin'), rateValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'Validation failed', errors.array());
    const { utility_type, rate_per_unit, effective_from } = req.body;
    const rateId = await UtilityRateModel.create({
      utility_type, rate_per_unit, effective_from,
      created_by: req.user.user_id,
    });
    return sendCreated(res, { rate_id: rateId, utility_type, rate_per_unit, effective_from },
      'Utility rate created successfully');
  } catch (err) { next(err); }
});

module.exports = router;
