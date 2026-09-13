/**
 * services/emailVerification.service.js
 *
 * รวม logic สร้าง+ส่งลิงก์ยืนยันอีเมล ให้ใช้ร่วมกันได้จากทุกจุดที่อีเมลถูก
 * ตั้ง/เปลี่ยน (register, createTenant, updateTenant, updateMyProfile)
 * แยกเป็น 2 ขั้นตอนเพราะจุดเรียกส่วนใหญ่อยู่ใน transaction:
 *   1. createVerificationToken — เรียกก่อน commit (rollback ได้ถ้า tx ล้มเหลว)
 *   2. sendVerificationEmailAsync — เรียกหลัง commit เท่านั้น (fire-and-forget
 *      เหมือน sendResetPasswordEmail กัน SMTP/SendGrid ช้าไปบล็อก response)
 */
const crypto = require('crypto');
const EmailVerificationModel = require('../models/emailVerification.model');
const { sendVerificationEmail } = require('./email.service');
const logger = require('../utils/logger');

const TOKEN_EXPIRY_MS = 1000 * 60 * 60 * 24; // 24 ชม.

const createVerificationToken = async (userId, conn = null) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
  await EmailVerificationModel.createToken(userId, token, expiresAt, conn);
  return token;
};

const sendVerificationEmailAsync = (userId, email, username, token) => {
  sendVerificationEmail(email, username, token).catch((err) => {
    logger.error('sendVerificationEmail failed', { userId, error: err.message });
  });
};

module.exports = { createVerificationToken, sendVerificationEmailAsync };
