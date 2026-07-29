/**
 * routes/auth.routes.js
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

const registerValidation = [
  // ลบ body('username') บรรทัดเดิมออกไปเลย แล้วใส่ phone แทน
  body('phone').trim().notEmpty().withMessage('Phone is required')
    .matches(/^[0-9]+$/).withMessage('Phone must contain only numbers'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'tenant']).withMessage('Role must be either admin or tenant'),
];

const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const updateProfileValidation = [
  body('firstName').optional().trim().isLength({ max: 100 }),
  body('lastName').optional().trim().isLength({ max: 100 }),
  body('email').optional({ nullable: true }).trim().isEmail().withMessage('Invalid email format'),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 20 }),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

const setPasswordValidation = [
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

// Public
router.post('/register', registerValidation, (req, res, next) => {
  if (req.body.role === 'admin') {
    return authenticate(req, res, () => {
      authorizeRoles('admin')(req, res, () => authController.register(req, res, next));
    });
  }
  authController.register(req, res, next);
});

router.post('/login', loginValidation, authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, updateProfileValidation, authController.updateProfile);
router.put('/change-password', authenticate, changePasswordValidation, authController.changePassword);

// ── ใหม่: OAuth user ตั้งรหัสผ่านครั้งแรก ──
router.post('/set-password', authenticate, setPasswordValidation, authController.setPassword);

module.exports = router;