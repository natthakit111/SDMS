/**
 * routes/settings.routes.js
 * Base path: /api/settings
 */

const express = require('express');
const router  = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { sendSuccess, sendBadRequest } = require('../utils/response');

router.get('/', authenticate, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM dorm_settings');
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    return sendSuccess(res, settings);
  } catch (err) { next(err); }
});

router.put('/', authenticate, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const allowed = [
      'dorm_name', 'dorm_address', 'admin_email', 'admin_phone',
      'currency', 'tax_rate',
      'bank_name', 'bank_account', 'bank_account_name',
      'notify_payment', 'notify_maintenance', 'notify_overdue',
      'water_billing_type',  // 'unit' | 'flat'
      'water_flat_rate',     // ราคาเหมาจ่ายต่อเดือน
    ];

    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
    if (updates.length === 0) return sendBadRequest(res, 'No valid fields to update');

    for (const [key, value] of updates) {
      await pool.query(
        `INSERT INTO dorm_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, String(value)]
      );
    }

    const [rows] = await pool.query('SELECT setting_key, setting_value FROM dorm_settings');
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    return sendSuccess(res, settings, 'Settings updated');
  } catch (err) { next(err); }
});

module.exports = router;