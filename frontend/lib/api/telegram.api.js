/**
 * frondend/lib/api/telegram.api.js
 * Backend: /api/telegram
 */
import api from './axiosInstance';

export const telegramAPI = {
  // ── Tenant ───────────────────────────────────────────────
  // เชื่อม Telegram account กับระบบ
  link: (chat_id) =>
    api.post('/telegram/link', { chat_id }).then((r) => r.data),

  unlink: () =>
    api.delete('/telegram/unlink').then((r) => r.data),

  getStatus: () =>
    api.get('/telegram/status').then((r) => r.data),
  // returns: { linked: boolean, chat_id: string | null }

  // สร้าง deep link ให้ผู้ใช้กดเปิดบอทเอง (ต่างจาก link() ที่บอทเรียกเองหลังผู้ใช้กดลิงก์)
  generateLink: () =>
    api.post('/telegram/generate-link').then((r) => r.data),
  // returns: { deepLink: string }

  // ── Admin only ────────────────────────────────────────────
  // ✅ เพิ่ม: alias สำหรับ admin link/unlink
  linkAdmin: (chat_id) =>
    api.post('/telegram/link', { chat_id }).then((r) => r.data),

  unlinkAdmin: () =>
    api.delete('/telegram/unlink').then((r) => r.data),

  // ✅ เพิ่ม: broadcast (alias ของ sendBroadcast)
  broadcast: (message) =>
    api.post('/telegram/broadcast', { message }).then((r) => r.data),

  sendBroadcast: (message) =>
    api.post('/telegram/broadcast', { message }).then((r) => r.data),
  // returns: { sent: number, total: number }
};