/**
 * config/telegram.js
 * Telegram Bot polling — handles /start link_<token> and /status
 *
 * Call initBot() from server.js after app.listen()
 */

const TelegramBot = require('node-telegram-bot-api');

let bot = null;

const initBot = () => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('[Bot] TELEGRAM_BOT_TOKEN not set — bot disabled');
    return;
  }

  const startPolling = () => {
    // ถ้ามี instance เก่าอยู่ให้หยุดก่อน
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
          // instance เก่ายังไม่ตาย — รอแล้ว retry
          console.warn('[Bot] 409 Conflict — retrying in 5s...');
          setTimeout(startPolling, 5000);
        } else {
          console.error('[Bot] Failed to start polling:', err.message);
        }
      });

    // จัดการ polling error ที่เกิดระหว่างรัน
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
          const mod = url.protocol === 'https:' ? require('https') : require('http');
          const req = mod.request({
            hostname: url.hostname,
            port:     url.port || (url.protocol === 'https:' ? 443 : 80),
            path:     url.pathname,
            method:   'POST',
            headers: {
              'Content-Type':   'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
          }, resolve);
          req.on('error', reject);
          req.write(body);
          req.end();
        });
      } catch (err) {
        bot.sendMessage(chatId, `❌ เกิดข้อผิดพลาด\n\nลิงก์อาจหมดอายุแล้ว กรุณากลับไปสร้างลิงก์ใหม่ที่แอป`);
      }
    });

    // ── /start (ไม่มี token) ──
    bot.onText(/\/start$/, (msg) => {
      bot.sendMessage(
        msg.chat.id,
        `👋 สวัสดีครับ!\n\nบอทนี้ใช้สำหรับรับแจ้งเตือนจากระบบบริหารจัดการหอพัก SDMS\n\nวิธีเชื่อมต่อ:\n1. เปิดแอป SDMS\n2. ไปที่ โปรไฟล์\n3. กด "เชื่อมต่อ Telegram"\n4. กดลิงก์ที่ได้`
      );
    });

    // ── /status ──
    bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id;
      const { pool } = require('./db');
      try {
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

  // เริ่ม polling (หน่วง 2 วินาทีให้ instance เก่าตายก่อน)
  setTimeout(startPolling, 2000);
};

module.exports = { initBot };