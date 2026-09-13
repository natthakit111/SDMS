/**
 * services/telegram.service.js
 *
 * Wraps the Telegram Bot API to send notifications to tenants and admins.
 * All functions are fire-and-forget — errors are logged but never crash the main flow.
 *
 * Respects per-user notification preferences (notify_bill, notify_overdue,
 * notify_maintenance, notify_announcement columns on `users`). Payment
 * confirmation/rejection and contract-expired notices are intentionally NOT
 * muteable (financial/legal evidence). Urgent announcements (is_urgent=1)
 * always bypass the notify_announcement mute.
 *
 * Every message that requires the tenant to take a self-service action in
 * the app (pay a bill, re-upload a rejected slip) includes an inline
 * keyboard button linking straight to the relevant page — consistent across
 * all bill/payment-related messages. Contract renewal intentionally still
 * says "contact the admin" since that genuinely requires a human (new
 * paperwork/negotiation), not a self-service action.
 */
const QRCode = require('qrcode');
const { thaiDateBangkok } = require('../utils/dateHelper');
const TelegramBot = require('node-telegram-bot-api');
const { pool }    = require('../config/db');
const UserModel = require('../models/user.model');
const TelegramLinkTokenModel = require('../models/telegramLinkToken.model');

// ── Bot singleton ─────────────────────────────────────────────
let bot = null;

const getBot = () => {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  }
  return bot;
};

// ── Log notification to DB ────────────────────────────────────
const logNotification = async (userId, type, message, billId = null, status = 'sent') => {
  try {
    await pool.query(
      `INSERT INTO notifications_log (user_id, bill_id, notification_type, message, status)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, billId || null, type, message, status]
    );
  } catch (err) {
    console.error('[Telegram] Failed to log notification:', err.message);
  }
};

// ── Notification preference check ─────────────────────────────
const ALLOWED_PREF_COLUMNS = new Set([
  'notify_bill',
  'notify_overdue',
  'notify_maintenance',
  'notify_announcement',
]);

const isNotificationAllowed = async (userId, prefColumn) => {
  if (!userId || !ALLOWED_PREF_COLUMNS.has(prefColumn)) return true;
  try {
    const [rows] = await pool.query(
      `SELECT ${prefColumn} FROM users WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    if (!rows[0]) return true;
    return rows[0][prefColumn] !== 0;
  } catch (err) {
    console.error('[Telegram] Pref check failed, sending anyway:', err.message);
    return true;
  }
};

// ── Core send function (no inline keyboard) ─────────────────────
const sendMessage = async (chatId, message, userId = null, type = 'general', billId = null) => {
  const instance = getBot();
  if (!instance) {
    console.warn('[Telegram] Bot not initialized — TELEGRAM_BOT_TOKEN missing');
    return;
  }
  try {
    await instance.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    if (userId) await logNotification(userId, type, message, billId, 'sent');
    console.log(`[Telegram] ✅ Sent to chatId ${chatId} | type: ${type}`);
  } catch (err) {
    console.error(`[Telegram] ❌ Failed to send to chatId ${chatId}:`, err.message);
    if (userId) await logNotification(userId, type, message, billId, 'failed');
  }
};

// ── Core send function (with inline keyboard button) ────────────
const sendMessageWithButton = async (chatId, message, buttonText, buttonUrl, userId = null, type = 'general', billId = null) => {
  const instance = getBot();
  if (!instance) {
    console.warn('[Telegram] Bot not initialized — TELEGRAM_BOT_TOKEN missing');
    return;
  }
  try {
    await instance.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
      },
    });
    if (userId) await logNotification(userId, type, message, billId, 'sent');
    console.log(`[Telegram] ✅ Sent to chatId ${chatId} | type: ${type}`);
  } catch (err) {
    console.error(`[Telegram] ❌ Failed to send to chatId ${chatId}:`, err.message);
    if (userId) await logNotification(userId, type, message, billId, 'failed');
  }
};

// ── Helpers ──────────────────────────────────────────────────
const THAI_MONTHS = [
  '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const thaiMonth = (m) => THAI_MONTHS[parseInt(m)] || m;
const formatAmount = (n) => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });

// Telegram legacy Markdown (parse_mode: 'Markdown') ตีความ _ * ` [ เป็นอักขระพิเศษ
// เสมอ — ค่าที่มาจากผู้ใช้ (ชื่อ, เลขห้อง, หมายเหตุ, username) ต้อง escape ก่อนแทรก
// ในข้อความ ไม่งั้นอักขระพวกนี้จะทำให้ format พังหรือทำให้ทั้งข้อความส่งไม่สำเร็จ
const escapeMarkdown = (text) =>
  text === null || text === undefined ? '' : String(text).replace(/([_*`[])/g, '\\$1');

// สร้างลิงก์หน้าชำระเงินแบบเดียวกันทุกจุด กันเขียนซ้ำผิดๆ ถูกๆ
const buildPaymentUrl = (billId) =>
  `${process.env.FRONTEND_URL}/login?redirect=${encodeURIComponent(`/tenant/payment?bill=${billId}`)}`;

// ════════════════════════════════════════════════════════════════
// 1. NEW BILL NOTIFICATION  (sent to tenant when admin generates bill)
//    Muteable via notify_bill
// ════════════════════════════════════════════════════════════════
const sendBillNotification = async (bill) => {
  if (!bill.telegram_chat_id) return;
  if (!(await isNotificationAllowed(bill.user_id, 'notify_bill'))) {
    console.log(`[Telegram] Skipped bill notification — user ${bill.user_id} muted notify_bill`);
    return;
  }
  const instance = getBot();
  if (!instance) {
    console.warn('[Telegram] Bot not initialized — TELEGRAM_BOT_TOKEN missing');
    return;
  }

  const dueDateStr = thaiDateBangkok(bill.due_date);

  const message = [
    `🏠 *แจ้งค่าเช่าประจำเดือน ${thaiMonth(bill.bill_month)} ${bill.bill_year}*`,
    `ห้อง: *${escapeMarkdown(bill.room_number)}*`,
    ``,
    `📋 รายละเอียด:`,
    `  • ค่าเช่า: ${formatAmount(bill.rent_amount)} บาท`,
    `  • ค่าไฟฟ้า: ${formatAmount(bill.electric_amount)} บาท`,
    `  • ค่าน้ำ: ${formatAmount(bill.water_amount)} บาท`,
    bill.other_amount > 0
      ? `  • ${bill.note ? escapeMarkdown(bill.note) : 'อื่นๆ'}: ${formatAmount(bill.other_amount)} บาท`
      : null,
    ``,
    `💰 *ยอดรวม: ${formatAmount(bill.total_amount)} บาท*`,
    `📅 กำหนดชำระ: *${dueDateStr}*`,
    ``,
    `กรุณาชำระผ่าน QR Code PromptPay บนเว็บไซต์`,
  ].filter(Boolean).join('\n');

  const payUrl = buildPaymentUrl(bill.bill_id);

  try {
    await instance.sendMessage(bill.telegram_chat_id, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '📄 ดูบิลและชำระเงิน', url: payUrl }]],
      },
    });

    if (bill.qr_payload) {
      const qrBuffer = await QRCode.toBuffer(bill.qr_payload, { margin: 1, width: 400 });
      await instance.sendPhoto(bill.telegram_chat_id, qrBuffer, {
        caption: 'สแกนเพื่อชำระผ่าน PromptPay',
      });
    }

    if (bill.user_id) await logNotification(bill.user_id, 'bill_notification', message, bill.bill_id, 'sent');
    console.log(`[Telegram] ✅ Sent bill notification to chatId ${bill.telegram_chat_id}`);
  } catch (err) {
    console.error(`[Telegram] ❌ Failed to send bill notification:`, err.message);
    if (bill.user_id) await logNotification(bill.user_id, 'bill_notification', message, bill.bill_id, 'failed');
  }
};

// ════════════════════════════════════════════════════════════════
// 2. PAYMENT CONFIRMED  (sent to tenant after admin verifies slip)
//    NOT muteable — เป็นหลักฐานทางการเงิน / ไม่ต้องมีปุ่ม เพราะไม่มี action ต่อ
// ════════════════════════════════════════════════════════════════
const sendPaymentConfirmation = async (payment) => {
  if (!payment.telegram_chat_id) return;

  const message = [
    `✅ *ยืนยันการชำระเงินสำเร็จ*`,
    ``,
    `ห้อง: *${escapeMarkdown(payment.room_number)}*`,
    `เดือน: ${thaiMonth(payment.bill_month)} ${payment.bill_year}`,
    `ยอดที่ชำระ: *${formatAmount(payment.amount_paid)} บาท*`,
    `วันที่ชำระ: ${new Date(payment.paid_at).toLocaleDateString('th-TH')}`,
    ``,
    `ขอบคุณที่ชำระค่าเช่าตรงเวลา 🙏`,
  ].join('\n');

  await sendMessage(payment.telegram_chat_id, message, payment.user_id || null, 'payment_confirm', payment.bill_id);
};

// ════════════════════════════════════════════════════════════════
// 3. PAYMENT REJECTED  (sent to tenant when admin rejects slip)
//    NOT muteable — เป็นหลักฐานทางการเงิน
//    NEW: เพิ่มปุ่มพาไปหน้าชำระเงิน/อัปโหลดสลิปใหม่โดยตรง
// ════════════════════════════════════════════════════════════════
const sendPaymentRejected = async (payment) => {
  if (!payment.telegram_chat_id) return;

  const message = [
    `❌ *การชำระเงินถูกปฏิเสธ*`,
    ``,
    `ห้อง: *${escapeMarkdown(payment.room_number)}*`,
    `เดือน: ${thaiMonth(payment.bill_month)} ${payment.bill_year}`,
    ``,
    `📝 เหตุผล: ${escapeMarkdown(payment.remark) || '-'}`,
    ``,
    `กรุณาเข้าเว็บไซต์เพื่ออัปโหลดหลักฐานการชำระเงินใหม่`,
  ].join('\n');

  const payUrl = buildPaymentUrl(payment.bill_id);

  await sendMessageWithButton(
    payment.telegram_chat_id, message, '📤 อัปโหลดสลิปใหม่', payUrl,
    payment.user_id || null, 'payment_rejected', payment.bill_id
  );
};

// ════════════════════════════════════════════════════════════════
// 4. BILL REMINDER  (sent by cron — 3 days / 1 day before due date)
//    Muteable via notify_bill (จัดกลุ่มเดียวกับบิลใหม่)
//    NEW: เพิ่มปุ่มพาไปหน้าชำระเงินโดยตรง เหมือน sendBillNotification
// ════════════════════════════════════════════════════════════════
const sendBillReminder = async (bill) => {
  if (!bill.telegram_chat_id) return;
  if (!(await isNotificationAllowed(bill.user_id, 'notify_bill'))) {
    console.log(`[Telegram] Skipped bill reminder — user ${bill.user_id} muted notify_bill`);
    return;
  }

  const dueDateStr = thaiDateBangkok(bill.due_date);
  const isFinal = !!bill._isFinalReminder;

  const headerLine = isFinal
    ? `🔴 *แจ้งเตือนด่วน: พรุ่งนี้ครบกำหนดชำระค่าเช่าแล้ว!*`
    : `⏰ *แจ้งเตือน: ใกล้ครบกำหนดชำระค่าเช่า (อีก 3 วัน)*`;
  const footerLine = isFinal
    ? `⚠️ นี่คือการแจ้งเตือนครั้งสุดท้ายก่อนถึงกำหนดชำระ กรุณาชำระโดยเร็วที่สุดเพื่อหลีกเลี่ยงค่าปรับ`
    : `กรุณาชำระก่อนครบกำหนดเพื่อหลีกเลี่ยงค่าปรับ`;

  const message = [
    headerLine,
    ``,
    `ห้อง: *${escapeMarkdown(bill.room_number)}*`,
    `เดือน: ${thaiMonth(bill.bill_month)} ${bill.bill_year}`,
    `💰 ยอดที่ต้องชำระ: *${formatAmount(bill.total_amount)} บาท*`,
    `📅 กำหนดชำระ: *${dueDateStr}*`,
    ``,
    footerLine,
  ].join('\n');

  const payUrl = buildPaymentUrl(bill.bill_id);

  await sendMessageWithButton(
    bill.telegram_chat_id, message, '💳 ชำระเงินตอนนี้', payUrl,
    bill.user_id || null,
    isFinal ? 'bill_reminder_final' : 'bill_reminder', bill.bill_id
  );
};

// ════════════════════════════════════════════════════════════════
// 5. OVERDUE NOTICE  (sent by cron — bill is now overdue, decaying frequency)
//    Muteable via notify_overdue
// ════════════════════════════════════════════════════════════════
const sendOverdueNotice = async (bill) => {
  if (!bill.telegram_chat_id) return;
  if (!(await isNotificationAllowed(bill.user_id, 'notify_overdue'))) {
    console.log(`[Telegram] Skipped overdue notice — user ${bill.user_id} muted notify_overdue`);
    return;
  }

  const message = [
    `🚨 *แจ้งเตือน: ค่าเช่าค้างชำระ*`,
    ``,
    `ห้อง: *${escapeMarkdown(bill.room_number)}*`,
    `เดือน: ${thaiMonth(bill.bill_month)} ${bill.bill_year}`,
    `💰 ยอดค้างชำระ: *${formatAmount(bill.total_amount)} บาท*`,
    `📅 ครบกำหนดเมื่อ: ${thaiDateBangkok(bill.due_date)}`,
    ``,
    `กรุณาเข้าเว็บไซต์เพื่อชำระเงินโดยเร็วที่สุด เพื่อหลีกเลี่ยงค่าปรับหรือปัญหาที่อาจตามมา`,
  ].join('\n');

  const payUrl = buildPaymentUrl(bill.bill_id);

  await sendMessageWithButton(
    bill.telegram_chat_id, message, '💳 ชำระเงินตอนนี้', payUrl,
    bill.user_id || null, 'overdue_notice', bill.bill_id
  );
};

// ════════════════════════════════════════════════════════════════
// 6. MAINTENANCE STATUS UPDATE  (sent to tenant on status change)
// ════════════════════════════════════════════════════════════════
const sendMaintenanceUpdate = async (request) => {
  if (!request.telegram_chat_id) return;
  if (!(await isNotificationAllowed(request.user_id, 'notify_maintenance'))) {
    console.log(`[Telegram] Skipped maintenance update — user ${request.user_id} muted notify_maintenance`);
    return;
  }

  const statusMap = {
    in_progress: { icon: '🔧', label: 'กำลังดำเนินการ' },
    resolved:    { icon: '✅', label: 'ดำเนินการเสร็จสิ้น' },
    cancelled:   { icon: '❌', label: 'ยกเลิกแล้ว' },
  };
  const s = statusMap[request.status] || { icon: '📋', label: request.status };

  const message = [
    `${s.icon} *อัปเดตคำร้องแจ้งซ่อม*`,
    ``,
    `ห้อง: *${escapeMarkdown(request.room_number)}*`,
    `หมวด: ${escapeMarkdown(request.category)}`,
    `สถานะ: *${s.label}*`,
    request.admin_note ? `📝 หมายเหตุจากผู้ดูแล: ${escapeMarkdown(request.admin_note)}` : null,
  ].filter(Boolean).join('\n');

  await sendMessage(request.telegram_chat_id, message, request.user_id || null, 'maintenance_update');
};

// ════════════════════════════════════════════════════════════════
// 7. CONTRACT EXPIRED  (sent by cron — expireContractsJob)
// ════════════════════════════════════════════════════════════════
const sendContractExpired = async (contract) => {
  if (!contract.telegram_chat_id) return;

  const message = [
    `📄 *แจ้งเตือน: สัญญาเช่าสิ้นสุดแล้ว*`,
    ``,
    `ห้อง: *${escapeMarkdown(contract.room_number)}*`,
    `วันที่ครบกำหนด: ${thaiDateBangkok(contract.end_date)}`,
    ``,
    `กรุณาติดต่อผู้ดูแลหอพักเพื่อต่อสัญญา หรือดำเนินการย้ายออกตามขั้นตอน`,
  ].join('\n');

  await sendMessage(contract.telegram_chat_id, message, contract.user_id || null, 'contract_expired', null);
};

// ════════════════════════════════════════════════════════════════
// 8. NEW PAYMENT SLIP SUBMITTED  (sent to admin chat)
// ════════════════════════════════════════════════════════════════
const notifyAdminNewPayment = async (payment) => {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!adminChatId) return;

  const message = [
    `💳 *มีการแจ้งชำระเงินใหม่*`,
    ``,
    `ผู้เช่า: *${escapeMarkdown(payment.tenant_name)}*`,
    `ห้อง: ${escapeMarkdown(payment.room_number)}`,
    `เดือน: ${thaiMonth(payment.bill_month)} ${payment.bill_year}`,
    `ยอด: *${formatAmount(payment.amount_paid)} บาท*`,
    ``,
    `กรุณาตรวจสอบและยืนยันการชำระเงินในระบบ`,
  ].join('\n');

  await sendMessage(adminChatId, message, null, 'admin_payment_alert');
};

// ════════════════════════════════════════════════════════════════
// 9. NEW MAINTENANCE REQUEST  (sent to admin chat)
// ════════════════════════════════════════════════════════════════
const notifyAdminNewMaintenance = async (request) => {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!adminChatId) return;

  const PRIORITY_DISPLAY = {
    high:   { icon: '🔴', label: 'สูง' },
    medium: { icon: '🟡', label: 'ปานกลาง' },
    low:    { icon: '🟢', label: 'ต่ำ' },
  };
  const p = PRIORITY_DISPLAY[request.priority] || { icon: '📋', label: request.priority };

  const message = [
    `🔧 *คำร้องแจ้งซ่อมใหม่*`,
    ``,
    `ห้อง: *${escapeMarkdown(request.room_number)}*`,
    `ผู้เช่า: ${escapeMarkdown(request.tenant_name)}`,
    `หมวด: ${escapeMarkdown(request.category)}`,
    `ความเร่งด่วน: ${p.icon} ${p.label}`,
    ``,
    `📝 รายละเอียด: ${escapeMarkdown(request.description)}`,
  ].join('\n');

  await sendMessage(adminChatId, message, null, 'admin_maintenance_alert');
};

// ════════════════════════════════════════════════════════════════
// 10. BROADCAST ANNOUNCEMENT  (sent to all tenants with chat_id)
// ════════════════════════════════════════════════════════════════
const broadcastAnnouncement = async (title, content, targetAudience = 'all', targetFloor = null, isUrgent = false) => {
  const instance = getBot();
  if (!instance) return;
  if (targetAudience === 'admin') return;

  let sql = `
    SELECT u.user_id, u.telegram_chat_id
    FROM users u
    JOIN tenants t ON u.user_id = t.user_id
    JOIN contracts c ON c.tenant_id = t.tenant_id AND c.status = 'active'
    JOIN rooms r ON r.room_id = c.room_id
    WHERE u.is_active = 1 AND u.telegram_chat_id IS NOT NULL
  `;
  const params = [];
  if (targetFloor) {
    sql += ' AND r.floor = ?';
    params.push(targetFloor);
  }
  if (!isUrgent) {
    sql += ' AND u.notify_announcement = 1';
  }
  const [users] = await pool.query(sql, params);

  const floorLabel = targetFloor ? ` (ชั้น ${targetFloor})` : '';
  const urgentTag = isUrgent ? '🚨 ' : '';
  const message = [`📢 ${urgentTag}*ประกาศจากหอพัก${floorLabel}*`, ``, `*${escapeMarkdown(title)}*`, ``, escapeMarkdown(content)].join('\n');

  for (const user of users) {
    await sendMessage(user.telegram_chat_id, message, user.user_id, isUrgent ? 'announcement_urgent' : 'announcement');
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`[Telegram] Broadcast sent to ${users.length} tenant(s)${floorLabel}${isUrgent ? ' [URGENT — bypassed mute]' : ''}`);
};

// ════════════════════════════════════════════════════════════════
// 11. CONFIRM TELEGRAM LINK  (called from telegram.routes.js POST /link)
//     ตรวจ token → บันทึก chat_id ลง users → ลบ token → ส่งข้อความต้อนรับ
//     ใช้ getBot()/sendMessage() ตัวเดียวกับฟังก์ชันอื่นในไฟล์นี้ แทนการ
//     สร้าง TelegramBot instance ใหม่ซ้ำซ้อน
// ════════════════════════════════════════════════════════════════
const confirmLink = async (token, chatId, telegramUsername) => {
  const record = await TelegramLinkTokenModel.findValid(token);
  if (!record) return false;

  const { user_id } = record;

  await UserModel.updateTelegramChatId(user_id, String(chatId));
  await TelegramLinkTokenModel.deleteToken(token);

  const user = await UserModel.findById(user_id);
  const displayName = telegramUsername || user?.username || 'ผู้เช่า';

  const message = [
    `✅ *เชื่อมต่อ Telegram สำเร็จ!*`,
    ``,
    `สวัสดี @${escapeMarkdown(displayName)}!`,
    `คุณจะได้รับการแจ้งเตือนค่าเช่า บิล และข่าวสารจากหอพักผ่าน Telegram นี้`,
    ``,
    `พิมพ์ /status เพื่อดูสถานะบิลปัจจุบัน`,
  ].join('\n');

  // ข้อความต้อนรับเป็น nice-to-have — ถ้าส่งไม่สำเร็จไม่ควรทำให้ /link ทั้ง request fail
  // sendMessage() จัดการ try/catch + log ให้อยู่แล้ว จึงไม่ต้อง wrap ซ้ำตรงนี้
  await sendMessage(chatId, message, user_id, 'telegram_link_welcome');

  return true;
};

module.exports = {
  sendBillNotification,
  sendPaymentConfirmation,
  sendPaymentRejected,
  sendBillReminder,
  sendOverdueNotice,
  sendMaintenanceUpdate,
  sendContractExpired,
  notifyAdminNewPayment,
  notifyAdminNewMaintenance,
  broadcastAnnouncement,
  confirmLink,
};