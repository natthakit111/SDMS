/**
 * services/telegram.service.js
 *
 * Wraps the Telegram Bot API to send notifications to tenants and admins.
 * All functions are fire-and-forget — errors are logged but never crash the main flow.
 *
 * Install: npm install node-telegram-bot-api
 *
 * Usage:
 *   const TelegramService = require('./telegram.service');
 *   await TelegramService.sendBillNotification(bill);
 */
const QRCode = require('qrcode');
const { thaiDateBangkok } = require('../utils/dateHelper');
const TelegramBot = require('node-telegram-bot-api');
const { pool }    = require('../config/db');

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

// ── Core send function ────────────────────────────────────────
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

// ── Helper: format Thai month name ───────────────────────────
const THAI_MONTHS = [
  '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const thaiMonth = (m) => THAI_MONTHS[parseInt(m)] || m;
const formatAmount = (n) => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });

// ════════════════════════════════════════════════════════════════
// 1. NEW BILL NOTIFICATION  (sent to tenant when admin generates bill)
// ════════════════════════════════════════════════════════════════
const sendBillNotification = async (bill) => {
  if (!bill.telegram_chat_id) return;
  const instance = getBot();
  if (!instance) {
    console.warn('[Telegram] Bot not initialized — TELEGRAM_BOT_TOKEN missing');
    return;
  }

  const dueDateStr = thaiDateBangkok(bill.due_date);

  const message = [
    `🏠 *แจ้งค่าเช่าประจำเดือน ${thaiMonth(bill.bill_month)} ${bill.bill_year}*`,
    `ห้อง: *${bill.room_number}*`,
    ``,
    `📋 รายละเอียด:`,
    `  • ค่าเช่า: ${formatAmount(bill.rent_amount)} บาท`,
    `  • ค่าไฟฟ้า: ${formatAmount(bill.electric_amount)} บาท`,
    `  • ค่าน้ำ: ${formatAmount(bill.water_amount)} บาท`,
    bill.other_amount > 0 ? `  • อื่นๆ: ${formatAmount(bill.other_amount)} บาท` : null,
    ``,
    `💰 *ยอดรวม: ${formatAmount(bill.total_amount)} บาท*`,
    `📅 กำหนดชำระ: *${dueDateStr}*`,
    ``,
    `กรุณาชำระผ่าน QR Code PromptPay ในแอปพลิเคชันหรือติดต่อผู้ดูแลหอพัก`,
  ].filter(Boolean).join('\n');

  const payUrl = `${process.env.FRONTEND_URL}/login?redirect=${encodeURIComponent(`/tenant/payment?bill=${bill.bill_id}`)}`;

  try {
    // 1. ข้อความ + ปุ่มลิงก์ไปหน้าบิลในแอป
    await instance.sendMessage(bill.telegram_chat_id, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '📄 ดูบิลและชำระเงิน', url: payUrl }]],
      },
    });

    // 2. QR Code รูปภาพ (ถ้ามี qr_payload)
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
// ════════════════════════════════════════════════════════════════
const sendPaymentConfirmation = async (payment) => {
  if (!payment.telegram_chat_id) return;

  const message = [
    `✅ *ยืนยันการชำระเงินสำเร็จ*`,
    ``,
    `ห้อง: *${payment.room_number}*`,
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
// ════════════════════════════════════════════════════════════════
const sendPaymentRejected = async (payment) => {
  if (!payment.telegram_chat_id) return;

  const message = [
    `❌ *การชำระเงินถูกปฏิเสธ*`,
    ``,
    `ห้อง: *${payment.room_number}*`,
    `เดือน: ${thaiMonth(payment.bill_month)} ${payment.bill_year}`,
    ``,
    `📝 เหตุผล: ${payment.remark || '-'}`,
    ``,
    `กรุณาอัปโหลดหลักฐานการชำระเงินใหม่ หรือติดต่อผู้ดูแลหอพัก`,
  ].join('\n');

  await sendMessage(payment.telegram_chat_id, message, payment.user_id || null, 'payment_rejected', payment.bill_id);
};

// ════════════════════════════════════════════════════════════════
// 4. BILL REMINDER  (sent by cron — 3 days before due date)
// ════════════════════════════════════════════════════════════════
const sendBillReminder = async (bill) => {
  if (!bill.telegram_chat_id) return;

  const message = [
    `⏰ *แจ้งเตือน: ใกล้ครบกำหนดชำระค่าเช่า*`,
    ``,
    `ห้อง: *${bill.room_number}*`,
    `เดือน: ${thaiMonth(bill.bill_month)} ${bill.bill_year}`,
    `💰 ยอดที่ต้องชำระ: *${formatAmount(bill.total_amount)} บาท*`,
    `📅 กำหนดชำระ: *${bill.due_date}*`,
    ``,
    `กรุณาชำระก่อนครบกำหนดเพื่อหลีกเลี่ยงค่าปรับ`,
  ].join('\n');

  await sendMessage(bill.telegram_chat_id, message, bill.user_id || null, 'bill_reminder', bill.bill_id);
};

// ════════════════════════════════════════════════════════════════
// 5. OVERDUE NOTICE  (sent by cron — bill is now overdue)
// ════════════════════════════════════════════════════════════════
const sendOverdueNotice = async (bill) => {
  if (!bill.telegram_chat_id) return;

  const message = [
    `🚨 *แจ้งเตือน: ค่าเช่าค้างชำระ*`,
    ``,
    `ห้อง: *${bill.room_number}*`,
    `เดือน: ${thaiMonth(bill.bill_month)} ${bill.bill_year}`,
    `💰 ยอดค้างชำระ: *${formatAmount(bill.total_amount)} บาท*`,
    `📅 ครบกำหนดเมื่อ: ${bill.due_date}`,
    ``,
    `กรุณาติดต่อผู้ดูแลหอพักโดยด่วนเพื่อชำระค่าเช่า`,
  ].join('\n');

  await sendMessage(bill.telegram_chat_id, message, bill.user_id || null, 'overdue_notice', bill.bill_id);
};

// ════════════════════════════════════════════════════════════════
// 6. MAINTENANCE STATUS UPDATE  (sent to tenant on status change)
// ════════════════════════════════════════════════════════════════
const sendMaintenanceUpdate = async (request) => {
  if (!request.telegram_chat_id) return;

  const statusMap = {
    in_progress: { icon: '🔧', label: 'กำลังดำเนินการ' },
    resolved:    { icon: '✅', label: 'ดำเนินการเสร็จสิ้น' },
    cancelled:   { icon: '❌', label: 'ยกเลิกแล้ว' },
  };
  const s = statusMap[request.status] || { icon: '📋', label: request.status };

  const message = [
    `${s.icon} *อัปเดตคำร้องแจ้งซ่อม*`,
    ``,
    `ห้อง: *${request.room_number}*`,
    `หมวด: ${request.category}`,
    `สถานะ: *${s.label}*`,
    request.admin_note ? `📝 หมายเหตุจากผู้ดูแล: ${request.admin_note}` : null,
  ].filter(Boolean).join('\n');

  await sendMessage(request.telegram_chat_id, message, null, 'maintenance_update');
};

// ════════════════════════════════════════════════════════════════
// 7. NEW PAYMENT SLIP SUBMITTED  (sent to admin chat)
// ════════════════════════════════════════════════════════════════
const notifyAdminNewPayment = async (payment) => {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!adminChatId) return;

  const message = [
    `💳 *มีการแจ้งชำระเงินใหม่*`,
    ``,
    `ผู้เช่า: *${payment.tenant_name}*`,
    `ห้อง: ${payment.room_number}`,
    `เดือน: ${thaiMonth(payment.bill_month)} ${payment.bill_year}`,
    `ยอด: *${formatAmount(payment.amount_paid)} บาท*`,
    ``,
    `กรุณาตรวจสอบและยืนยันการชำระเงินในระบบ`,
  ].join('\n');

  await sendMessage(adminChatId, message, null, 'admin_payment_alert');
};

// ════════════════════════════════════════════════════════════════
// 8. NEW MAINTENANCE REQUEST  (sent to admin chat)
// ════════════════════════════════════════════════════════════════
const notifyAdminNewMaintenance = async (request) => {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!adminChatId) return;

  const priorityIcon = { high: '🔴', medium: '🟡', low: '🟢' };

  const message = [
    `🔧 *คำร้องแจ้งซ่อมใหม่*`,
    ``,
    `ห้อง: *${request.room_number}*`,
    `ผู้เช่า: ${request.tenant_name}`,
    `หมวด: ${request.category}`,
    `ความเร่งด่วน: ${priorityIcon[request.priority] || ''} ${request.priority.toUpperCase()}`,
    ``,
    `📝 รายละเอียด: ${request.description}`,
  ].join('\n');

  await sendMessage(adminChatId, message, null, 'admin_maintenance_alert');
};

// ════════════════════════════════════════════════════════════════
// 9. BROADCAST ANNOUNCEMENT  (sent to all tenants with chat_id)
// ════════════════════════════════════════════════════════════════
const broadcastAnnouncement = async (title, content, targetAudience = 'all', targetFloor = null) => {
  const instance = getBot();
  if (!instance) return;
  if (targetAudience === 'admin') return; // admin-only announcements not broadcast to Telegram

  // Fetch tenant chat_ids — optionally filtered by floor
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
  const [users] = await pool.query(sql, params);

  const floorLabel = targetFloor ? ` (ชั้น ${targetFloor})` : '';
  const message = [`📢 *ประกาศจากหอพัก${floorLabel}*`, ``, `*${title}*`, ``, content].join('\n');

  for (const user of users) {
    await sendMessage(user.telegram_chat_id, message, user.user_id, 'announcement');
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`[Telegram] Broadcast sent to ${users.length} tenant(s)${floorLabel}`);
};

module.exports = {
  sendBillNotification,
  sendPaymentConfirmation,
  sendPaymentRejected,
  sendBillReminder,
  sendOverdueNotice,
  sendMaintenanceUpdate,
  notifyAdminNewPayment,
  notifyAdminNewMaintenance,
  broadcastAnnouncement,
};
