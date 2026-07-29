/**
 * routes/contract.routes.js
 * Specific paths BEFORE wildcard /:id
 * Frontend calls /my/active — added as alias for /my
 */
const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const ctrl = require('../controllers/contractController');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

const createContractValidation = [
  body('tenant_id').isInt({ min: 1 }),
  body('room_id').isInt({ min: 1 }),
  body('start_date').isDate(),
  body('end_date').isDate(),
  body('deposit_amount').optional().isFloat({ min: 0 }),
  body('rent_amount').optional().isFloat({ min: 0 }),
];

const updateValidation = [
  body('end_date').optional().isDate(),
  body('rent_amount').optional().isFloat({ min: 0 }),
];

const renewValidation = [
  body('end_date').isDate(),
  body('rent_amount').optional().isFloat({ min: 0 }),
];

// ── Upload config for contract files (PDF / Word) ─────────────
const contractsDir = path.join(__dirname, '../../uploads/contracts');
if (!fs.existsSync(contractsDir)) fs.mkdirSync(contractsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, contractsDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('รองรับเฉพาะไฟล์ PDF หรือ Word เท่านั้น'));
  },
});

router.use(authenticate);

// ── Tenant self-service — BEFORE /:id ────────────────────────
// Support both /my and /my/active (frontend calls /my/active)
router.get('/my',        authorizeRoles('tenant'), ctrl.getMyContract);
router.get('/my/active', authorizeRoles('tenant'), ctrl.getMyContract); // alias

// ── Admin list ────────────────────────────────────────────────
router.get('/',   authorizeRoles('admin'), ctrl.getAllContracts);
router.post('/',  authorizeRoles('admin'), createContractValidation, ctrl.createContract);

// ── Wildcard paths LAST ───────────────────────────────────────
router.get('/:id',              ctrl.getContractById);
router.put('/:id',              authorizeRoles('admin'), updateValidation, ctrl.updateContract);
router.put('/:id/renew',        authorizeRoles('admin'), renewValidation, ctrl.renewContract);
router.put('/:id/terminate',    authorizeRoles('admin', 'tenant'), ctrl.terminateContract);

// ── Contract file upload/download ──────────────────────────────
router.post('/:id/upload', authorizeRoles('admin'), upload.single('file'), ctrl.uploadContractFile);
router.get('/:id/file',    ctrl.downloadContractFile); // สิทธิ์เจ้าของเช็คในตัว controller

module.exports = router;