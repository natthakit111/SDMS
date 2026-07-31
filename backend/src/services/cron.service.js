const cron = require('node-cron');
const { pool } = require('../config/db');
const BillModel     = require('../models/bill.model');
const TelegramService = require('./telegram.service');

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

const markOverdueBillsJob = () => {
  cron.schedule('5 0 * * *', async () => {
    try {
      const count = await BillModel.markOverdueBills();
      console.log(`[Cron] Marked ${count} bill(s) as overdue`);
    } catch (err) {
      console.error('[Cron] markOverdueBillsJob error:', err.message);
    }
  }, { timezone: 'Asia/Bangkok' });
};

const sendOverdueNoticesJob = () => {
  cron.schedule('30 8 * * *', async () => {
    try {
      // NOTE: assumes notifications_log has a `created_at` timestamp column
      // (verify against database/schema.sql). Without this guard, the same
      // overdue bill got re-notified every single day indefinitely — this
      // throttles it to at most one overdue notice per bill per calendar day.
      const bills = await getBillsWithChatId(`
        b.status = 'overdue'
        AND NOT EXISTS (
          SELECT 1 FROM notifications_log nl
          WHERE nl.bill_id = b.bill_id
            AND nl.notification_type = 'overdue_notice'
            AND nl.status = 'sent'
            AND DATE(nl.created_at) = CURDATE()
        )
      `);
      for (const bill of bills) {
        await TelegramService.sendOverdueNotice(bill);
      }
    } catch (err) {
      console.error('[Cron] sendOverdueNoticesJob error:', err.message);
    }
  }, { timezone: 'Asia/Bangkok' });
};

const sendBillRemindersJob = () => {
  cron.schedule('0 8 * * *', async () => {
    try {
      const bills = await getBillsWithChatId(
        `b.status = 'pending' AND b.due_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)`
      );
      for (const bill of bills) {
        await TelegramService.sendBillReminder(bill);
      }
    } catch (err) {
      console.error('[Cron] sendBillRemindersJob error:', err.message);
    }
  }, { timezone: 'Asia/Bangkok' });
};

const sendFinalRemindersJob = () => {
  cron.schedule('0 9 * * *', async () => {
    try {
      const bills = await getBillsWithChatId(
        `b.status = 'pending' AND b.due_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
      );
      for (const bill of bills) {
        await TelegramService.sendBillReminder({ ...bill, _isFinalReminder: true });
      }
    } catch (err) {
      console.error('[Cron] sendFinalRemindersJob error:', err.message);
    }
  }, { timezone: 'Asia/Bangkok' });
};

const expireContractsJob = () => {
  cron.schedule('0 1 * * *', async () => {
    try {
      // Fetch the tenants affected BEFORE flipping status, so we know who to notify.
      const [contracts] = await pool.query(`
        SELECT c.contract_id, c.end_date, r.room_number, u.user_id, u.telegram_chat_id
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

      for (const contract of contracts) {
        await TelegramService.sendContractExpired(contract);
      }
    } catch (err) {
      console.error('[Cron] expireContractsJob error:', err.message);
    }
  }, { timezone: 'Asia/Bangkok' });
};

const initCronJobs = () => {
  markOverdueBillsJob();
  sendOverdueNoticesJob();
  sendBillRemindersJob();
  sendFinalRemindersJob();
  expireContractsJob();
};

module.exports = {
  initCronJobs,
  // exported for testing internal handlers directly
  __test__: { getBillsWithChatId },
};
