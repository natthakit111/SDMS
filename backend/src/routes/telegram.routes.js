/**
 * routes/telegram.routes.js
 * Base path: /api/telegram
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { sendSuccess, sendBadRequest } = require('../utils/response');
const UserModel = require('../models/user.model');
const TenantModel = require('../models/tenant.model');
const TelegramLinkTokenModel = require('../models/telegramLinkToken.model');
const TelegramService = require('../services/telegram.service');

// ─────────────────────────────────────────────
// GET /api/telegram/status
// ─────────────────────────────────────────────
router.get('/status', authenticate, async (req, res, next) => {
  try {
    const chatId = await UserModel.getTelegramChatId(req.user.user_id);
    return sendSuccess(res, { linked: !!chatId, chat_id: chatId });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
// POST /api/telegram/generate-link
// ─────────────────────────────────────────────
router.post('/generate-link', authenticate, async (req, res, next) => {
  try {
    const token     = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10); // 10 นาที

    await TelegramLinkTokenModel.createOrReplace(req.user.user_id, token, expiresAt);

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || '';
    const deepLink    = `https://t.me/${botUsername}?start=link_${token}`;

    return sendSuccess(res, { deepLink, token, expiresAt });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
// POST /api/telegram/link
// เรียกโดย bot หลังจาก user กด deep link
// Body: { token, chat_id, telegram_username }
// ─────────────────────────────────────────────
router.post('/link', async (req, res, next) => {
  try {
    // ⚠️ FIX: เดิมไม่มี auth เลย และเชื่อ chat_id จาก body ตรงๆ — ใครก็ตาม
    // ที่รู้ token (อาจหลุดผ่าน deep link ที่แชร์กัน) ยิง POST พร้อม chat_id
    // ของตัวเองมาแทนได้ ทำให้ได้รับการแจ้งเตือนของเหยื่อไป ตอนนี้เช็ค
    // secret ที่ share กันระหว่าง backend กับ bot service (config/telegram.js)
    // ก่อนยอมรับเสมอ ไม่ใช่ JWT เพราะ endpoint นี้ไม่ได้เรียกโดย user
    // ที่ login อยู่ แต่เรียกโดย internal bot process เท่านั้น
    const internalSecret = req.headers['x-internal-secret'];
    if (!internalSecret || internalSecret !== process.env.BOT_INTERNAL_SECRET) {
      return sendBadRequest(res, 'Unauthorized');
    }

    const { token, chat_id, telegram_username } = req.body;
    if (!token || !chat_id) return sendBadRequest(res, 'token and chat_id are required');

    const linked = await TelegramService.confirmLink(token, chat_id, telegram_username);
    if (!linked) return sendBadRequest(res, 'Token ไม่ถูกต้องหรือหมดอายุ');

    return sendSuccess(res, null, 'เชื่อมต่อ Telegram สำเร็จ');
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
// DELETE /api/telegram/unlink
// ─────────────────────────────────────────────
router.delete('/unlink', authenticate, async (req, res, next) => {
  try {
    await UserModel.clearTelegramChatId(req.user.user_id);
    return sendSuccess(res, null, 'ยกเลิกการเชื่อมต่อ Telegram แล้ว');
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
// POST /api/telegram/broadcast  — admin only
// ─────────────────────────────────────────────
router.post('/broadcast', authenticate, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return sendBadRequest(res, 'message is required');

    await TelegramService.broadcastAnnouncement('ข้อความจากผู้ดูแล', message, 'tenant', null);

    const total = await TenantModel.countActiveWithTelegram();
    return sendSuccess(res, { sent: total }, `Broadcast sent to ${total} tenant(s)`);
  } catch (err) { next(err); }
});

module.exports = router;