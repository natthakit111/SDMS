/**
 * routes/auth.routes.js
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { getRateLimitStore } = require('../utils/rateLimitStore');

// กัน brute-force บน endpoint ที่อ่อนไหว (login/register/forgot-password)
// store: RedisStore ถ้าตั้งค่า REDIS_URL ไว้ (จำเป็นเมื่อ deploy หลาย
// instance) ไม่งั้น fallback เป็น MemoryStore ของ default — ดู
// utils/rateLimitStore.js
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  store: getRateLimitStore(),
});

const registerValidation = [
  body('phone').trim().notEmpty().withMessage('Phone is required')
    .matches(/^[0-9]+$/).withMessage('Phone must contain only numbers'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  // ⚠️ FIX: ตัด body('role').optional().isIn(['admin', 'tenant']) ออก —
  // /register ตอนนี้ไม่รับ role จาก client แล้วทั้งที่ route/controller
  // เก็บ validator ที่ยอมรับ role ไว้เฉยๆ ไม่มีประโยชน์ และทำให้คนอ่านโค้ด
  // เข้าใจผิดว่า endpoint นี้ยังรองรับการส่ง role อยู่
];

const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const updateProfileValidation = [
  body('firstName').optional().trim().isLength({ max: 100 }),
  body('lastName').optional().trim().isLength({ max: 100 }),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail().withMessage('Invalid email format'),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 20 }),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

const setPasswordValidation = [
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

// Public
// ⚠️ FIX: ตัด branch "role === 'admin' → ต้อง authenticate ก่อน" ออก —
// เดิมดูเหมือนเผื่อไว้ให้ admin สร้าง admin คนใหม่ผ่าน endpoint นี้ แต่
// authController.register() hardcode role เป็น 'tenant' เสมอไปแล้ว (กัน
// role escalation จาก client โดยตรง) ทำให้ branch นี้เป็น dead code ที่
// ทำงานขัดกับ controller — ถ้า admin login แล้วยิง role:"admin" มาถูกต้อง
// ตาม guard นี้ ก็ยังได้ tenant account อยู่ดี สร้างความสับสน
// /auth/register ตอนนี้เป็น self-register สาธารณะสำหรับ tenant เท่านั้น
router.post('/register', authLimiter, registerValidation, authController.register);

router.post('/login', authLimiter, loginValidation, authController.login);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);

// ⚠️ ใหม่: logout ต้องผ่าน backend เสมอ เพราะ cookie `token` เป็น httpOnly
// — JS ฝั่ง frontend แตะ/ลบเองไม่ได้อีกต่อไปหลัง migrate จาก localStorage
// ไม่ต้อง authenticate ก่อนก็ได้ (ถ้าไม่มี session อยู่แล้ว การ clearCookie
// ก็แค่ไม่มีผลอะไร ไม่ error)
router.post('/logout', authController.logout);

// Protected
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, updateProfileValidation, authController.updateProfile);
router.put('/change-password', authenticate, changePasswordValidation, authController.changePassword);

// ── ใหม่: OAuth user ตั้งรหัสผ่านครั้งแรก ──
router.post('/set-password', authenticate, setPasswordValidation, authController.setPassword);

module.exports = router;