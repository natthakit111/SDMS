/**
 * services/cron.service.js
 *
 * Scheduled background jobs using node-cron.
 * Called once from server.js on startup.
 *
 * Schedule summary:
 *   ┌─────────────────────── every day at 00:05 (mark overdue bills)
 *   ├─────────────────────── every day at 01:00 (auto-expire contracts + notify)
 *   ├─────────────────────── every day at 08:00 (bill reminder, 3 days before due)
 *   ├─────────────────────── every day at 08:30 (send overdue Telegram notices — decaying frequency)
 *   └─────────────────────── every day at 09:00 (final reminder, 1 day before due)
 *
 * Each job function is exported directly (see module.exports at the bottom)
 * so it can be triggered manually for testing without touching the cron
 * pattern — e.g. `__test__.runSendOverdueNoticesNow()`.
 */

const cron = require('node-cron');
const { pool } = require('../config/db');
const BillModel     = require('../models/bill.model');
const RoomModel     = require('../models/room.model');
const TelegramService = require('./telegram.service');

// ── Helper: get bills with tenant telegram_chat_id ────────────
const getBillsWithChatId = async (whereClause, params = []) => {
  const [rows] = await pool.query(`
    SELECT b.*,
           r.room_number,
           u.user_id,
           u.telegram_chat_id,
           CONCAT(t.first_name,' ',t.last_name) AS tenant_name
    FROM bills b
    JOIN rooms     r  ON b.room_id     = r.room_id
    JOIN contracts c  ON b.contract_id = c.contract_id
    JOIN tenants   t  ON c.tenant_id   = t.tenant_id
    JOIN users     u  ON t.user_id     = u.user_id
    WHERE u.telegram_chat_id IS NOT NULL
      AND u.is_active = 1
      AND ${whereClause}
  `, params);
  return rows;
};

// ════════════════════════════════════════════════════════════════
// JOB 1: Mark overdue bills — runs daily at 00:05
// ════════════════════════════════════════════════════════════════
const runMarkOverdueBillsNow = async () => {
  try {
    const count = await BillModel.markOverdueBills();
    console.log(`[Cron] Marked ${count} bill(s) as overdue`);
  } catch (err) {
    console.error('[Cron] markOverdueBillsJob error:', err.message);
  }
};

const markOverdueBillsJob = () => {
  cron.schedule('5 0 * * *', runMarkOverdueBillsNow, { timezone: 'Asia/Bangkok' });
};

// ════════════════════════════════════════════════════════════════
// JOB 2: Send overdue Telegram notices — runs daily at 08:30
//
// NEW: decaying frequency แทนการส่งซ้ำทุกวันไม่มีลิมิต — เตือนเฉพาะวันที่
// ค้างชำระครบ 1, 3, 7, 14, 30 วัน (นับจาก due_date) แทนที่จะส่งทุกวันตั้งแต่
// วันที่ 1 จนกว่าจะจ่าย ซึ่งสร้าง Alert Fatigue ให้ผู้เช่า
//
// ยังคง guard กันส่งซ้ำภายในวันเดียวกันไว้ (เผื่อ job รันซ้ำโดยไม่ตั้งใจ)
// ════════════════════════════════════════════════════════════════
const OVERDUE_REMINDER_DAYS = [1, 3, 7, 14, 30];

const runSendOverdueNoticesNow = async () => {
  try {
    const dayList = OVERDUE_REMINDER_DAYS.join(',');
    const bills = await getBillsWithChatId(`
      b.status = 'overdue'
      AND DATEDIFF(CURDATE(), b.due_date) IN (${dayList})
      AND NOT EXISTS (
        SELECT 1 FROM notifications_log nl
        WHERE nl.bill_id = b.bill_id
          AND nl.notification_type = 'overdue_notice'
          AND nl.status = 'sent'
          AND DATE(nl.sent_at) = CURDATE()
      )
    `);
    console.log(`[Cron] Sending overdue notices to ${bills.length} tenant(s) (day milestones: ${dayList})`);
    for (const bill of bills) {
      await TelegramService.sendOverdueNotice(bill);
    }
  } catch (err) {
    console.error('[Cron] sendOverdueNoticesJob error:', err.message);
  }
};

const sendOverdueNoticesJob = () => {
  cron.schedule('30 8 * * *', runSendOverdueNoticesNow, { timezone: 'Asia/Bangkok' });
};

// ════════════════════════════════════════════════════════════════
// JOB 3: Bill reminders (3 days before due) — runs daily at 08:00
// ════════════════════════════════════════════════════════════════
const runSendBillRemindersNow = async () => {
  try {
    const bills = await getBillsWithChatId(
      `b.status = 'pending' AND b.due_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)`
    );
    console.log(`[Cron] Sending bill reminders to ${bills.length} tenant(s)`);
    for (const bill of bills) {
      await TelegramService.sendBillReminder(bill);
    }
  } catch (err) {
    console.error('[Cron] sendBillRemindersJob error:', err.message);
  }
};

const sendBillRemindersJob = () => {
  cron.schedule('0 8 * * *', runSendBillRemindersNow, { timezone: 'Asia/Bangkok' });
};

// ════════════════════════════════════════════════════════════════
// JOB 4: Final reminder (1 day before due) — runs daily at 09:00
// ════════════════════════════════════════════════════════════════
const runSendFinalRemindersNow = async () => {
  try {
    const bills = await getBillsWithChatId(
      `b.status = 'pending' AND b.due_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
    );
    console.log(`[Cron] Sending final reminders to ${bills.length} tenant(s)`);
    for (const bill of bills) {
      await TelegramService.sendBillReminder({ ...bill, _isFinalReminder: true });
    }
  } catch (err) {
    console.error('[Cron] sendFinalRemindersJob error:', err.message);
  }
};

const sendFinalRemindersJob = () => {
  cron.schedule('0 9 * * *', runSendFinalRemindersNow, { timezone: 'Asia/Bangkok' });
};

// ════════════════════════════════════════════════════════════════
// JOB 5: Auto-expire contracts + notify — runs daily at 01:00
// ════════════════════════════════════════════════════════════════
const runExpireContractsNow = async () => {
  try {
    const [contracts] = await pool.query(`
      SELECT c.contract_id, c.room_id, c.end_date, r.room_number, u.user_id, u.telegram_chat_id
      FROM contracts c
      JOIN rooms   r ON c.room_id   = r.room_id
      JOIN tenants t ON c.tenant_id = t.tenant_id
      JOIN users   u ON t.user_id   = u.user_id
      WHERE c.status = 'active' AND c.end_date < CURDATE()
    `);

    const [result] = await pool.query(`
      UPDATE contracts SET status = 'expired'
      WHERE status = 'active' AND end_date < CURDATE()
    `);
    if (result.affectedRows > 0) {
      console.log(`[Cron] Expired ${result.affectedRows} contract(s)`);
    }

    // ⚠️ FIX: เดิม cron นี้ไม่ปล่อยห้องคืนเลย — สัญญาหมดอายุแล้วแต่ห้องยัง
    // ค้างสถานะ occupied ตลอดไปจนกว่าแอดมินจะมาแก้เอง (ต้องผ่าน move-out/
    // terminate ถึงจะปล่อยห้อง แต่สัญญาที่หมดอายุเองไม่มีคำร้องแบบนั้น)
    for (const contract of contracts) {
      await RoomModel.updateStatus(contract.room_id, 'available');
      await TelegramService.sendContractExpired(contract);
    }
  } catch (err) {
    console.error('[Cron] expireContractsJob error:', err.message);
  }
};

const expireContractsJob = () => {
  cron.schedule('0 1 * * *', runExpireContractsNow, { timezone: 'Asia/Bangkok' });
};

// ════════════════════════════════════════════════════════════════
// INIT — call this once from server.js
// ════════════════════════════════════════════════════════════════
const initCronJobs = () => {
  markOverdueBillsJob();
  sendOverdueNoticesJob();
  sendBillRemindersJob();
  sendFinalRemindersJob();
  expireContractsJob();

  console.log('⏰  Cron jobs initialized:');
  console.log('    00:05 — Mark overdue bills');
  console.log('    01:00 — Auto-expire contracts + notify');
  console.log('    08:00 — Bill reminders (3 days before due)');
  console.log(`    08:30 — Overdue notices (day ${OVERDUE_REMINDER_DAYS.join('/')} milestones only)`);
  console.log('    09:00 — Final reminders (1 day before due)');
};

module.exports = {
  initCronJobs,
  OVERDUE_REMINDER_DAYS,
  __test__: {
    getBillsWithChatId,
    runMarkOverdueBillsNow,
    runSendOverdueNoticesNow,
    runSendBillRemindersNow,
    runSendFinalRemindersNow,
    runExpireContractsNow,
  },
};