/**
 * config/telegram.js
 * Telegram Bot polling — handles /start link_<token> and /status
 *
 * Call initBot() from server.js after app.listen()
 *
 * ⚠️ IMPORTANT (dependency pin): the currently-published node-telegram-bot-api
 * on npm (v1.2.0+) is a full rewrite with an incompatible API (Bot/Api classes,
 * object-based params). This file relies on the OLD API:
 *   new TelegramBot(token, { polling: false })
 *   bot.sendMessage(chatId, text, options)
 *   bot.startPolling(...) / bot.onText(...) / bot.on('polling_error', ...)
 * package.json MUST pin a compatible version, e.g.:
 *   "node-telegram-bot-api": "^0.66.0"
 * Installing "latest" will break this file at runtime with
 * "TelegramBot is not a constructor".
 */

const TelegramBot = require('node-telegram-bot-api');

let bot = null;

const initBot = () => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('[Bot] TELEGRAM_BOT_TOKEN not set — bot disabled');
    return;
  }

  const startPolling = () => {
    if (bot) {
      try { bot.stopPolling(); } catch {}
      bot = null;
    }

    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

    bot.startPolling({ restart: false })
      .then(() => {
        console.log('🤖 Telegram Bot polling started');
        registerHandlers();
      })
      .catch((err) => {
        if (err?.code === 'ETELEGRAM' && err?.message?.includes('409')) {
          console.warn('[Bot] 409 Conflict — retrying in 5s...');
          setTimeout(startPolling, 5000);
        } else {
          console.error('[Bot] Failed to start polling:', err.message);
        }
      });

    bot.on('polling_error', (err) => {
      if (err?.code === 'ETELEGRAM' && err?.message?.includes('409')) {
        console.warn('[Bot] 409 Conflict during polling — retrying in 5s...');
        bot.stopPolling().catch(() => {});
        setTimeout(startPolling, 5000);
      } else {
        console.error('[Bot] polling_error:', err.message);
      }
    });
  };

  const registerHandlers = () => {
    const BACKEND = process.env.BACKEND_URL || 'http://localhost:5000/api';

    // ── /start link_<token> ──
    bot.onText(/\/start link_([a-f0-9]+)/, async (msg, match) => {
      const chatId           = msg.chat.id;
      const token            = match[1];
      const telegramUsername = msg.from?.username || '';

      try {
        const body = JSON.stringify({ token, chat_id: chatId, telegram_username: telegramUsername });

        await new Promise((resolve, reject) => {
          const url = new URL(`${BACKEND}/telegram/link`);
          const mod = url.protocol === 'https:' ? require('https') : require('http')
          const req = mod.request({
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
              'X-Internal-Secret': process.env.BOT_INTERNAL_SECRET, 
            },
          }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(data);
              } else {
                reject(new Error(`Backend responded ${res.statusCode}: ${data}`));
              }
            });
          });
          req.on('error', reject);
          req.write(body);
          req.end();
        });

        // ข้อความต้อนรับส่งจาก TelegramService.confirmLink() ฝั่ง backend แล้ว
        // (แยกข้อความตาม role ผู้เช่า/admin) — ไม่ส่งซ้ำตรงนี้อีก
      } catch (err) {
        bot.sendMessage(chatId, `❌ เกิดข้อผิดพลาด\n\nลิงก์อาจหมดอายุแล้ว กรุณากลับไปสร้างลิงก์ใหม่ที่แอป`);
      }
    });

    // ── /start (ไม่มี token) ──
    bot.onText(/\/start$/, (msg) => {
      bot.sendMessage(
        msg.chat.id,
        `👋 สวัสดีครับ!\n\nบอทนี้ใช้สำหรับรับแจ้งเตือนจากระบบบริหารจัดการหอพักและแจ้งเตือนอัตโนมัติ SDMS\n\nวิธีเชื่อมต่อ:\n1. เปิดเว็ป SDMS\n2. ไปที่ โปรไฟล์\n3. กด "เชื่อมต่อ Telegram"\n4. กดลิงก์ที่ได้`
      );
    });

    // ── /status ──
    bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id;
      const { pool } = require('./db');
      try {
        const [linked] = await pool.query(
          'SELECT role FROM users WHERE telegram_chat_id = ? AND is_active = 1 LIMIT 1',
          [String(chatId)]
        );
        if (linked[0]?.role === 'admin') {
          // admin ไม่มีบิล — สรุปงานที่รอดำเนินการแทน
          const [[counts]] = await pool.query(`
            SELECT
              (SELECT COUNT(*) FROM payments WHERE status = 'pending_verify')                  AS pending_payments,
              (SELECT COUNT(*) FROM maintenance_requests WHERE status = 'pending')             AS pending_maintenance,
              (SELECT COUNT(*) FROM move_out_requests WHERE status = 'pending')                AS pending_move_outs,
              (SELECT COUNT(*) FROM bills WHERE status = 'overdue')                            AS overdue_bills
          `);
          return bot.sendMessage(
            chatId,
            [
              '📊 *งานที่รอดำเนินการ*',
              '',
              `💳 สลิปรอตรวจ: *${counts.pending_payments}*`,
              `🔧 แจ้งซ่อมรอรับเรื่อง: *${counts.pending_maintenance}*`,
              `🚪 คำร้องขอย้ายออกรออนุมัติ: *${counts.pending_move_outs}*`,
              `🔴 บิลค้างชำระ: *${counts.overdue_bills}*`,
            ].join('\n'),
            { parse_mode: 'Markdown' }
          );
        }

        const [bills] = await pool.query(`
          SELECT b.bill_month, b.bill_year, b.total_amount, b.status, r.room_number
          FROM bills b
          JOIN rooms r ON b.room_id = r.room_id
          JOIN contracts c ON b.contract_id = c.contract_id
          JOIN tenants t ON c.tenant_id = t.tenant_id
          JOIN users u ON t.user_id = u.user_id
          WHERE u.telegram_chat_id = ? AND b.status IN ('pending','overdue')
          ORDER BY b.bill_year DESC, b.bill_month DESC LIMIT 3
        `, [String(chatId)]);

        if (!bills.length) return bot.sendMessage(chatId, '✅ ไม่มีบิลค้างชำระ');

        const MONTHS = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        const text = bills.map(b =>
          `📋 ห้อง ${b.room_number} | ${MONTHS[b.bill_month]} ${b.bill_year} | *${Number(b.total_amount).toLocaleString()} บาท* | ${b.status === 'overdue' ? '🔴 เกินกำหนด' : '🟡 รอชำระ'}`
        ).join('\n');
        bot.sendMessage(chatId, `📊 *บิลค้างชำระ:*\n\n${text}`, { parse_mode: 'Markdown' });
      } catch {
        bot.sendMessage(chatId, '❌ เกิดข้อผิดพลาด กรุณาลองใหม่');
      }
    });

    // ── /unlink ──
    bot.onText(/\/unlink/, async (msg) => {
      const chatId = msg.chat.id;
      const { pool } = require('./db');
      try {
        await pool.query(
          'UPDATE users SET telegram_chat_id = NULL WHERE telegram_chat_id = ?',
          [String(chatId)]
        );
        bot.sendMessage(chatId, '✅ ยกเลิกการเชื่อมต่อแล้ว คุณจะไม่ได้รับแจ้งเตือนอีกต่อไป');
      } catch {
        bot.sendMessage(chatId, '❌ เกิดข้อผิดพลาด');
      }
    });
  };

  setTimeout(startPolling, 2000);
};

module.exports = { initBot };
