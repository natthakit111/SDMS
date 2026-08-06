/**
 * controllers/authController.js
 *
 * ⚠️ SECURITY MIGRATION (localStorage → httpOnly cookie):
 * เดิม login() คืน { token, user } ทาง JSON body แล้วให้ frontend เก็บ
 * token เองใน localStorage — เปลี่ยนมาให้ backend เป็นคน set httpOnly
 * cookie ตรงนี้แทน เพื่อไม่ให้ JS ฝั่ง frontend แตะ token ได้เลย
 *
 * ตั้งคุกกี้คู่กันเสมอ 2 ตัว (ดู setAuthCookies ด้านล่าง):
 *   - `token`      → httpOnly, เก็บ JWT จริง (JS แตะไม่ได้)
 *   - `auth_hint`  → ไม่ใช่ httpOnly, เก็บแค่ "1" ไม่มีข้อมูลอ่อนไหว
 *                    มีไว้ให้ frontend เช็คได้ว่ามี session อยู่ไหม
 *                    (ดู axiosInstance.js ฝั่ง frontend ที่ใช้ค่านี้
 *                    ตัดสินใจว่าจะ force logout ตอนโดน 401 หรือไม่)
 */

const crypto = require('crypto');
const PasswordResetModel = require('../models/passwordReset.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const UserModel = require('../models/user.model');
const TenantModel = require('../models/tenant.model');
const { sendResetPasswordEmail } = require('../services/email.service');
const {
  sendSuccess, sendCreated, sendBadRequest, sendUnauthorized,
} = require('../utils/response');

// ⚠️ frontend และ backend อยู่คนละโดเมนกันแน่ๆ ตอน production (เช่น
// frontend บน Vercel, backend บน Railway/Render) ตั้ง COOKIE_CROSS_SITE=true
// ใน .env ของ production เท่านั้น — local dev ปล่อยว่างไว้ (false)
const CROSS_SITE = process.env.COOKIE_CROSS_SITE === 'true';

const signToken = (user, rememberMe = false) => {
  // ⚠️ ใหม่: csrf claim — ใช้คู่กับ csrf_token cookie (ไม่ httpOnly) ทำ
  // double-submit CSRF protection เพราะพอย้าย sameSite เป็น 'none'
  // (จำเป็นเนื่องจาก frontend/backend คนละโดเมน) เกราะป้องกัน CSRF ที่
  // sameSite เคยให้ฟรีๆ จะหายไปทันที ต้องมีกลไกอื่นมาแทน
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const token = jwt.sign(
    { user_id: user.user_id, username: user.username, role: user.role, csrf: csrfToken },
    process.env.JWT_SECRET,
    { expiresIn: rememberMe ? "7d" : "1d" }
  );
  return { token, csrfToken };
};

/**
 * ตั้งคุกกี้ 3 ตัวพร้อมกันเสมอ:
 *   - token       → httpOnly, JWT จริง
 *   - auth_hint   → readable, บอกแค่ "มี session อยู่ไหม"
 *   - csrf_token  → readable, ใช้คู่กับ header X-CSRF-Token (double-submit)
 *
 * sameSite/secure ปรับตาม CROSS_SITE:
 *   - โดเมนเดียวกัน (dev, หรือ deploy จริงแบบ subdomain เดียวกัน)
 *     → sameSite: 'lax' พอ ไม่ต้อง secure ก็ได้ (ทดสอบผ่าน http ได้)
 *   - คนละโดเมน (deploy จริงของโปรเจกต์นี้)
 *     → ต้อง sameSite: 'none' + secure: true เท่านั้น (browser บังคับ
 *       ว่า SameSite=None ต้องมาคู่กับ Secure เสมอ ไม่งั้น cookie ใช้ไม่ได้เลย)
 */
const setAuthCookies = (res, token, csrfToken, rememberMe = false) => {
  const maxAge = (rememberMe ? 7 : 1) * 24 * 60 * 60 * 1000; // ต้องตรงกับ expiresIn ของ JWT

  // ⚠️ FIX: เดิมมี `|| IS_PROD` fallback ตรงนี้ ซึ่งพัง เพราะเครื่อง dev
  // บางเครื่องตั้ง NODE_ENV=production ไว้ด้วยเหตุผลอื่น (เช่น performance
  // ของ Express) ทำให้ secure: true ถูกบังคับใช้อยู่ดีแม้ตั้งใจจะปิดตอน
  // local — ต้องคุมด้วย COOKIE_SECURE ที่ตั้งเองตรงๆ เท่านั้น ไม่ผูกกับ
  // NODE_ENV อีกต่อไป (default false ถ้าไม่ตั้งค่า — ใช้งานผ่าน http ได้)
  const secure = CROSS_SITE ? true : (process.env.COOKIE_SECURE === 'true');
  const sameSite = CROSS_SITE ? 'none' : 'lax';

  res.cookie('token', token, { httpOnly: true, secure, sameSite, maxAge, path: '/' });
  res.cookie('auth_hint', '1', { httpOnly: false, secure, sameSite, maxAge, path: '/' });
  res.cookie('csrf_token', csrfToken, { httpOnly: false, secure, sameSite, maxAge, path: '/' });
};

const clearAuthCookies = (res) => {
  res.clearCookie('token', { path: '/' });
  res.clearCookie('auth_hint', { path: '/' });
  res.clearCookie('csrf_token', { path: '/' });
};

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'Validation failed', errors.array());

    const { password, role = 'tenant', name, email, phone } = req.body;
    const autoUsername = phone;

    const existing = await UserModel.findByUsername(autoUsername);
    if (existing) return sendBadRequest(res, 'เบอร์โทรศัพท์นี้ถูกใช้สมัครสมาชิกไปแล้ว');

    if (role === 'tenant') {
      const conflict = await TenantModel.findConflictByPhoneOrEmail(phone, email);
      if (conflict) {
        const conflictField = conflict.phone === phone ? 'เบอร์โทรศัพท์' : 'อีเมล';
        return sendBadRequest(
          res,
          `${conflictField}นี้มีบัญชีผู้เช่าอยู่ในระบบแล้ว กรุณาติดต่อผู้ดูแลหอพัก หรือใช้ "ลืมรหัสผ่าน" หากจำรหัสผ่านไม่ได้`
        );
      }
    }

    const nameParts = (name || '').trim().split(' ');
    const firstName = nameParts[0] || autoUsername;
    const lastName  = nameParts.slice(1).join(' ') || '';

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    const userId = await UserModel.createUser({
      username: autoUsername, password_hash, role,
      first_name: firstName, last_name: lastName, email, phone,
    });

    if (role === 'tenant') {
      await TenantModel.createFromSelfRegistration({
        userId, firstName, lastName, phone, email,
      });
    }

    return sendCreated(res, { user_id: userId, username: autoUsername, role }, 'Account registered successfully');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return sendBadRequest(res, 'ERROR_DUPLICATE_ENTRY');
    }
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { username, password, rememberMe } = req.body;
    const identifier = (username || '').trim();

    if (!identifier) {
      return sendBadRequest(res, "กรุณากรอกข้อมูลเข้าสู่ระบบ");
    }

    const user = await UserModel.findByIdentifier(identifier);

    if (!user) return sendUnauthorized(res, "ไม่พบข้อมูลเบอร์โทรศัพท์ อีเมล หรือชื่อผู้ใช้นี้");
    if (!user.is_active) return sendUnauthorized(res, "บัญชีนี้ถูกปิดการใช้งาน");

    if (!user.password_hash) return sendUnauthorized(res, "บัญชีนี้ใช้การเข้าสู่ระบบด้วย Google หรือ Telegram");

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return sendUnauthorized(res, "รหัสผ่านไม่ถูกต้อง");

    const { token, csrfToken } = signToken(user, rememberMe);
    setAuthCookies(res, token, csrfToken, rememberMe);

    // ⚠️ เดิมคืน `token` ใน body ด้วย — ตัดออกแล้ว เพราะตอนนี้ JWT อยู่ใน
    // httpOnly cookie เท่านั้น ไม่ควรมี copy ของ token ลอยอยู่ใน JSON
    // response ให้ JS อ่านได้อีกทาง (จะกลายเป็นช่องโหว่แทรกซ้อนทันที)
    return sendSuccess(res, {
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (err) { next(err); }
};

// ⚠️ ใหม่: logout ต้องผ่าน backend เสมอ เพราะ `token` เป็น httpOnly
// JS ฝั่ง frontend แตะ/ลบเองไม่ได้อีกต่อไป
const logout = async (req, res, next) => {
  try {
    clearAuthCookies(res);
    return sendSuccess(res, null, 'ออกจากระบบสำเร็จ');
  } catch (err) { next(err); }
};

const getMe = async (req, res, next) => {
  try {
    const profile = await UserModel.getProfileById(req.user.user_id);
    if (!profile) return sendUnauthorized(res, 'User no longer exists');
    return sendSuccess(res, profile);
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'Validation failed', errors.array());

    const { firstName, lastName, email, phone } = req.body;

    await UserModel.updateProfileFields(req.user.user_id, { firstName, lastName, email, phone });
    const profile = await UserModel.getProfileById(req.user.user_id);

    return sendSuccess(res, profile, 'Profile updated successfully');
  } catch (err) { next(err); }
};

const setPassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'Validation failed', errors.array());

    const { newPassword } = req.body;

    const currentHash = await UserModel.getPasswordHash(req.user.user_id);
    if (currentHash === null) return sendUnauthorized(res, 'User not found');

    if (currentHash && currentHash !== '') {
      return sendBadRequest(res, 'บัญชีนี้มีรหัสผ่านอยู่แล้ว กรุณาใช้ "เปลี่ยนรหัสผ่าน" แทน');
    }

    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newPassword, salt);
    await UserModel.setPasswordHash(req.user.user_id, newHash);

    return sendSuccess(res, null, 'ตั้งรหัสผ่านสำเร็จ');
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'Validation failed', errors.array());

    const { currentPassword, newPassword } = req.body;

    const currentHash = await UserModel.getPasswordHash(req.user.user_id);
    if (currentHash === null) return sendUnauthorized(res, 'User not found');

    if (!currentHash || currentHash === '') {
      return sendBadRequest(res, 'บัญชีนี้ยังไม่มีรหัสผ่าน กรุณาใช้ "ตั้งรหัสผ่าน" แทน');
    }

    const isMatch = await bcrypt.compare(currentPassword, currentHash);
    if (!isMatch) return sendBadRequest(res, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');

    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newPassword, salt);
    await UserModel.setPasswordHash(req.user.user_id, newHash);

    return sendSuccess(res, null, 'เปลี่ยนรหัสผ่านสำเร็จ');
  } catch (err) { next(err); }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { username } = req.body;
    const identifier = (username || '').trim();

    if (!identifier) return sendBadRequest(res, 'กรุณากรอกอีเมลหรือเบอร์โทรศัพท์');

    const user = await UserModel.findByIdentifier(identifier);

    if (!user) return sendSuccess(res, null, 'หากมีข้อมูลของคุณในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้ทางอีเมล');

    if (!user.email) return sendBadRequest(res, 'บัญชีนี้ไม่มีอีเมลผูกอยู่ ไม่สามารถส่งลิงก์รีเซ็ตได้ กรุณาติดต่อผู้ดูแลหอพัก');

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15);
    await PasswordResetModel.createResetToken(user.user_id, token, expiresAt);
    await sendResetPasswordEmail(user.email, user.username, token);

    return sendSuccess(res, null, 'ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว');
  } catch (err) { next(err); }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const record = await PasswordResetModel.findByToken(token);
    if (!record) return sendBadRequest(res, 'Token ไม่ถูกต้อง');
    if (new Date(record.expires_at) < new Date()) return sendBadRequest(res, 'Token หมดอายุ');

    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newPassword, salt);
    await UserModel.setPasswordHash(record.user_id, newHash);
    await PasswordResetModel.deleteToken(token);

    return sendSuccess(res, null, 'เปลี่ยนรหัสผ่านสำเร็จ');
  } catch (err) { next(err); }
};

module.exports = {
  register, login, logout, getMe, updateProfile,
  changePassword, setPassword, forgotPassword, resetPassword,
  signToken, setAuthCookies, clearAuthCookies, // export ไว้ให้ oauth.routes.js เรียกใช้ร่วมกัน
};