/**
 * controllers/notificationPreference.controller.js
 *
 * ให้ผู้เช่าดู/แก้ไขการตั้งค่าว่าจะรับแจ้งเตือน Telegram ประเภทไหนบ้าง
 * ต่อยอดจากความสามารถ "แก้ไขข้อมูลส่วนตัว" ของผู้เช่า (ข้อ 13.2.5 ในเอกสารขอบเขต)
 *
 * ไม่รวม payment_confirm / payment_rejected เพราะเป็นหลักฐานทางการเงินที่ต้องส่งเสมอ
 */
const { pool } = require('../config/db')
const { sendSuccess, sendBadRequest } = require('../utils/response')

const PREF_FIELDS = ['notify_bill', 'notify_overdue', 'notify_maintenance', 'notify_announcement']

// GET /api/tenant/notification-preferences
const getPreferences = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${PREF_FIELDS.join(', ')} FROM users WHERE user_id = ? LIMIT 1`,
      [req.user.user_id]
    )
    return sendSuccess(res, rows[0] || {})
  } catch (err) { next(err) }
}

// PUT /api/tenant/notification-preferences
// body: { notify_bill?: boolean, notify_overdue?: boolean, notify_maintenance?: boolean, notify_announcement?: boolean }
const updatePreferences = async (req, res, next) => {
  try {
    const updates = {}
    for (const field of PREF_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field] ? 1 : 0
      }
    }
    if (Object.keys(updates).length === 0) {
      return sendBadRequest(res, 'ไม่มีข้อมูลที่จะอัปเดต')
    }

    const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(', ')
    await pool.query(
      `UPDATE users SET ${setClause} WHERE user_id = ?`,
      [...Object.values(updates), req.user.user_id]
    )

    return sendSuccess(res, updates, 'บันทึกการตั้งค่าแจ้งเตือนสำเร็จ')
  } catch (err) { next(err) }
}

module.exports = { getPreferences, updatePreferences }