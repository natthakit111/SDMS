/**
 * routes/report.routes.js
 * Base path: /api/reports
 * Admin only — export data as Excel / PDF.
 *
 * GET /api/reports/revenue?year=2025&format=excel
 * GET /api/reports/revenue?year=2025&format=pdf
 * GET /api/reports/rooms?format=excel
 * GET /api/reports/payments?month=3&year=2025&format=excel
 * GET /api/reports/system-export           — export ข้อมูลระบบทั้งหมด (Excel, multi-sheet)
 */

const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/reportController')
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware')

router.get('/revenue',        authenticate, authorizeRoles('admin'), ctrl.getRevenueReport)
router.get('/rooms',          authenticate, authorizeRoles('admin'), ctrl.getRoomsReport)
router.get('/payments',       authenticate, authorizeRoles('admin'), ctrl.getPaymentsReport)
router.get('/system-export',  authenticate, authorizeRoles('admin'), ctrl.getSystemExport)

module.exports = router