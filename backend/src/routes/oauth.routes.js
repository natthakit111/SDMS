/**
 * routes/oauth.routes.js
 * Base path: /api/auth
 *
 * Google  : GET /api/auth/google  →  GET /api/auth/google/callback
 * Telegram: GET /api/auth/telegram  (Login Widget page)
 *           GET /api/auth/telegram/callback  (widget redirects here)
 *
 * ⚠️ SECURITY FIX (สำคัญ):
 * เดิม callback ทั้งสองฝั่ง (Google/Telegram) redirect กลับ frontend พร้อม
 * JWT เต็มๆ (session token อายุ 1 วัน) ฝังใน query string ตรงๆ
 * (?token=eyJhbGci...) ซึ่งเสี่ยงหลุดผ่าน:
 *   - Browser history (ใครก็ตามที่เข้าถึงเครื่อง/ประวัติได้ คัดลอกไป
 *     login แทนได้เลย)
 *   - Server / proxy access log (เห็นตัวอย่างจริงว่า token โผล่ในเทอร์มินัล
 *     log ตรงๆ ระหว่าง dev — ถ้า deploy จริงจะไปอยู่ใน log service ตลอดอายุ
 *     retention)
 *   - Referer header (ถ้าหน้า callback โหลด resource จากภายนอก)
 *
 * แก้โดยเปลี่ยนมาส่ง "exchange code" แบบ opaque, สุ่ม, ใช้ได้ครั้งเดียว,
 * อายุแค่ 60 วินาที แทน แล้วให้ frontend ยิง POST ไป exchange เป็น JWT จริง
 * ทันที (ได้ JWT กลับทาง JSON response body เท่านั้น ไม่ผ่าน URL อีกเลย)
 * ดู models/oauthCode.model.js สำหรับรายละเอียด flow เต็ม
 *
 * Install:
 *   npm install passport passport-google-oauth20
 *   (ไม่ต้องใช้ passport-telegram แล้ว — verify เองด้วย HMAC)
 *
 * .env:
 *   GOOGLE_CLIENT_ID=...
 *   GOOGLE_CLIENT_SECRET=...
 *   TELEGRAM_BOT_TOKEN=...
 *   TELEGRAM_BOT_USERNAME=YourBotName
 *   BACKEND_URL=http://localhost:5000/api
 *   FRONTEND_URL=http://localhost:3000
 */

const express  = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const crypto   = require('crypto');
const jwt      = require('jsonwebtoken');
const router   = express.Router();
const { pool } = require('../config/db');
const OAuthCodeModel = require('../models/oauthCode.model');
const logger   = require('../utils/logger');
const { sendSuccess, sendBadRequest } = require('../utils/response');
// ⚠️ ใช้ signToken + setAuthCookies ตัวเดียวกับ authController.js เสมอ —
// ห้ามเขียน logic sign JWT / set cookie ซ้ำอีกที่ ไม่งั้นถ้าแก้ค่า (เช่น
// เพิ่ม csrf claim, เปลี่ยน sameSite) ทีหลังแล้วลืมแก้ให้ครบทุกจุด จะมี
// behavior ไม่ตรงกันระหว่าง regular login กับ OAuth login
const { signToken, setAuthCookies } = require('../controllers/auth.controller');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL  = process.env.BACKEND_URL  || 'http://localhost:5000/api';

/* ─────────────────────────────────────────
   Helper: upsert OAuth user
───────────────────────────────────────── */
async function upsertOAuthUser({ provider, providerId, email, displayName }) {
  // 1. Find by provider + providerId
  const [existing] = await pool.query(
    'SELECT * FROM users WHERE oauth_provider = ? AND oauth_provider_id = ? LIMIT 1',
    [provider, String(providerId)]
  );
  if (existing.length > 0) return existing[0];

  // 2. Find by email (link accounts)
  if (email) {
    const [byEmail] = await pool.query(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (byEmail.length > 0) {
      await pool.query(
        'UPDATE users SET oauth_provider = ?, oauth_provider_id = ? WHERE user_id = ?',
        [provider, String(providerId), byEmail[0].user_id]
      );
      return byEmail[0];
    }
  }

  // 3. Create new tenant account
  const nameParts = (displayName || '').trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName  = nameParts.slice(1).join(' ') || '';

  // ใช้ชื่อจริงเป็น base username (lowercase, no space)
  const baseUsername = (displayName || `${provider}_${providerId}`)
    .toLowerCase()
    .replace(/\s+/g, '_')       // space → underscore
    .replace(/[^a-z0-9_]/g, '') // ตัดอักขระพิเศษออก
    .slice(0, 40);              // จำกัดความยาว

  // ป้องกันชื่อซ้ำ — เติม _2, _3 ถ้าซ้ำ
  let username = baseUsername;
  let counter  = 2;
  while (true) {
    const [taken] = await pool.query(
      'SELECT user_id FROM users WHERE username = ? LIMIT 1',
      [username]
    );
    if (taken.length === 0) break;
    username = `${baseUsername}_${counter++}`;
  }

  // ⚠️ FIX: เดิม insert users แล้วตามด้วย INSERT IGNORE tenants แยกกัน
  // ไม่ห่อ transaction — ถ้า insert tenant ล้มเหลว (เช่น phone ชน unique
  // constraint) จะเหลือ orphaned user (role='tenant' แต่ไม่มี tenants
  // row ผูกอยู่) เหมือนบั๊กเดียวกับที่เคยแก้ใน authController.register()
  //
  // ⚠️ FIX สำคัญกว่า: เดิม phone hardcode เป็น '0000000000' คงที่ทุกคน —
  // ตั้งแต่เพิ่ม UNIQUE constraint บน tenants.phone ไปแล้ว คนที่ 2 ที่
  // login ผ่าน OAuth (ไม่ว่า provider ไหน) จะ insert tenant ไม่ผ่านทันที
  // เปลี่ยนเป็น placeholder ที่ unique ต่อ user_id แทน
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO users
         (username, password_hash, role, first_name, last_name, email,
          oauth_provider, oauth_provider_id, is_active)
       VALUES (?, '', 'tenant', ?, ?, ?, ?, ?, 1)`,
      [username, firstName, lastName, email || null, provider, String(providerId)]
    );
    const newUserId = result.insertId;

    const placeholderIdCard = `OAUTH${String(newUserId).padStart(8, '0')}`;
    const placeholderPhone  = `0000${String(newUserId).padStart(6, '0')}`; // unique ต่อ user_id

    await conn.query(
      `INSERT INTO tenants (user_id, first_name, last_name, id_card_number, phone, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        newUserId,
        firstName || 'ไม่ระบุ',
        lastName  || 'ไม่ระบุ',
        placeholderIdCard,
        placeholderPhone,
        email || null,
      ]
    );

    await conn.commit();

    const [newUser] = await pool.query(
      'SELECT * FROM users WHERE user_id = ? LIMIT 1',
      [newUserId]
    );
    return newUser[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* ═════════════════════════════════════════
   OAUTH EXCHANGE — endpoint กลาง ใช้ร่วมกันทั้ง Google/Telegram
   Frontend เรียกทันทีหลังถูก redirect กลับมาพร้อม ?code=xxx
═════════════════════════════════════════ */
router.post('/oauth/exchange', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return sendBadRequest(res, 'Missing exchange code');

    const userId = await OAuthCodeModel.consumeCode(code);
    if (!userId) return sendBadRequest(res, 'Code ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่');

    const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [userId]);
    const user = rows[0];
    if (!user || !user.is_active) return sendBadRequest(res, 'บัญชีนี้ถูกปิดการใช้งาน');

    const { token, csrfToken } = signToken(user);

    // ⚠️ เดิมคืน `token` ทาง JSON body — ตัดออกแล้ว เปลี่ยนมา set httpOnly
    // cookie เหมือนกับ regular login ใน authController.js แทน (ใช้ helper
    // เดียวกัน ไม่เขียนซ้ำ) frontend จะได้ role จาก `user` ใน response
    // เพื่อตัดสินใจ redirect เท่านั้น ไม่ต้องแตะ token เลย
    setAuthCookies(res, token, csrfToken, false); // OAuth login ไม่มี "remember me" — ใช้ 1 วันเสมอ

    return sendSuccess(res, {
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) { next(err); }
});

/* ═════════════════════════════════════════
   GOOGLE OAUTH
   ⚠️ ลงทะเบียนเฉพาะตอนตั้งค่า GOOGLE_CLIENT_ID/SECRET ไว้เท่านั้น — เดิม
   new GoogleStrategy() ถูกสร้างแบบ unconditional ทำให้ทั้งเซิร์ฟเวอร์
   crash ตั้งแต่ require('./app') ถ้าไม่ได้ตั้งค่าไว้ (throw จาก
   passport-oauth2 เพราะ clientID ว่าง) ซึ่งขัดกับที่ README สัญญาไว้ว่า
   ตัวแปรที่ไม่ได้ตั้งค่าควรแค่ปิดฟีเจอร์นั้นเงียบๆ ไม่ควร crash ทั้งแอป
═════════════════════════════════════════ */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  `${BACKEND_URL}/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await upsertOAuthUser({
            provider:    'google',
            providerId:  profile.id,
            email:       profile.emails?.[0]?.value,
            displayName: profile.displayName,
          });
          done(null, user);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );

  router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
  );

  router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login` }),
    async (req, res) => {
      try {
        // ⚠️ FIX: เดิม sign JWT เต็มแล้วฝังใน query ตรงๆ (?token=...)
        // เปลี่ยนเป็นสร้าง exchange code สั้นๆ อายุ 60 วิ ใช้ครั้งเดียวแทน
        const code = await OAuthCodeModel.createCode(req.user.user_id);
        res.redirect(`${FRONTEND_URL}/auth/google/callback?code=${code}`);
      } catch (err) {
        // ⚠️ เดิม catch เฉยๆ ไม่ log อะไรเลย ทำให้ debug ไม่ได้ว่าพังเพราะอะไร
        // เพิ่ม log ไว้ชั่วคราวเพื่อเห็นสาเหตุจริง (เช่น ตาราง
        // oauth_exchange_codes ยังไม่ถูกสร้าง จาก migration ที่ยังไม่ได้รัน)
        console.error('[OAuth] Failed to create exchange code:', err);
        res.redirect(`${FRONTEND_URL}/auth/google/callback?error=${encodeURIComponent('เกิดข้อผิดพลาด')}`);
      }
    }
  );
} else {
  logger.warn('[OAuth] GOOGLE_CLIENT_ID/SECRET not set — Google login disabled');
  router.get('/google', (req, res) => {
    res.status(503).json({ success: false, message: 'Google login is not configured' });
  });
}

/* ═════════════════════════════════════════
   TELEGRAM LOGIN WIDGET
   ไม่ต้องใช้ passport — verify HMAC เอง
   https://core.telegram.org/widgets/login
═════════════════════════════════════════ */

function verifyTelegramData(data) {
  const { hash, ...rest } = data;
  if (!hash) return false;

  // Reject if older than 5 minutes
  if (Date.now() / 1000 - parseInt(rest.auth_date, 10) > 300) return false;

  const checkString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('\n');

  const secretKey = crypto
    .createHash('sha256')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  const expected = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  return expected === hash;
}

// หน้า Login Widget
router.get('/telegram', (req, res) => {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || '';
  const callbackUrl = `${BACKEND_URL}/auth/telegram/callback`;

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Login with Telegram</title>
  <style>
    body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f2f5;font-family:sans-serif}
    .box{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,.1);text-align:center}
    p{color:#666;margin-top:.5rem;font-size:.9rem}
  </style>
</head>
<body>
  <div class="box">
    <h2>เข้าสู่ระบบด้วย Telegram</h2>
    <p>กดปุ่มด้านล่างเพื่ออนุญาต</p>
    <script async
      src="https://telegram.org/js/telegram-widget.js?22"
      data-telegram-login="${botUsername}"
      data-size="large"
      data-auth-url="${callbackUrl}"
      data-request-access="write">
    </script>
  </div>
</body>
</html>`);
});

// Callback ที่ widget redirect มา
router.get('/telegram/callback', async (req, res) => {
  try {
    if (!verifyTelegramData(req.query)) {
      return res.redirect(
        `${FRONTEND_URL}/auth/telegram/callback?error=${encodeURIComponent('ข้อมูลจาก Telegram ไม่ถูกต้อง')}`
      );
    }

    const { id, first_name, last_name } = req.query;

    const user = await upsertOAuthUser({
      provider:    'telegram',
      providerId:  id,
      email:       null,
      displayName: [first_name, last_name].filter(Boolean).join(' '),
    });

    await pool.query(
      'UPDATE users SET telegram_chat_id = ? WHERE user_id = ?',
      [String(id), user.user_id]
    );

    // ⚠️ FIX: เดิม sign JWT เต็มแล้วฝังใน query ตรงๆ (?token=...) เหมือนฝั่ง
    // Google — เปลี่ยนเป็น exchange code สั้นๆ อายุ 60 วิ ใช้ครั้งเดียวแทน
    const code = await OAuthCodeModel.createCode(user.user_id);
    res.redirect(`${FRONTEND_URL}/auth/telegram/callback?code=${code}`);
  } catch (err) {
    console.error('Telegram OAuth error:', err);
    res.redirect(
      `${FRONTEND_URL}/auth/telegram/callback?error=${encodeURIComponent('เกิดข้อผิดพลาด')}`
    );
  }
});

module.exports = router;