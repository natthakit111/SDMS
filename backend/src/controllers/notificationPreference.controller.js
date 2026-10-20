/**
 * controllers/notificationPreference.controller.js
 *
 * ให้ผู้เช่าดู/แก้ไขการตั้งค่าว่าจะรับแจ้งเตือน Telegram ประเภทไหนบ้าง
 * ต่อยอดจากความสามารถ "แก้ไขข้อมูลส่วนตัว" ของผู้เช่า (ข้อ 13.2.5 ในเอกสารขอบเขต)
 *
 * ไม่รวม payment_confirm / payment_rejected เพราะเป็นหลักฐานทางการเงินที่ต้องส่งเสมอ
 *
 * admin ใช้ endpoint เดียวกัน แต่เห็น/แก้ได้เฉพาะ toggle ฝั่ง admin (notify_admin_*)
 */
const { pool } = require('../config/db')
const { sendSuccess, sendBadRequest } = require('../utils/response')

const TENANT_PREF_FIELDS = ['notify_bill', 'notify_overdue', 'notify_maintenance', 'notify_announcement']
const ADMIN_PREF_FIELDS = [
  'notify_admin_payment',
  'notify_admin_maintenance',
  'notify_admin_move_out',
  'notify_admin_registration',
]

const fieldsForRole = (role) => (role === 'admin' ? ADMIN_PREF_FIELDS : TENANT_PREF_FIELDS)

// GET /api/tenants/notification-preferences
const getPreferences = async (req, res, next) => {
  try {
    const PREF_FIELDS = fieldsForRole(req.user.role)
    const [rows] = await pool.query(
      `SELECT ${PREF_FIELDS.join(', ')} FROM users WHERE user_id = ? LIMIT 1`,
      [req.user.user_id]
    )
    return sendSuccess(res, rows[0] || {})
  } catch (err) { next(err) }
}

// PUT /api/tenants/notification-preferences
// body (tenant): { notify_bill?, notify_overdue?, notify_maintenance?, notify_announcement? }
// body (admin):  { notify_admin_payment?, notify_admin_maintenance?, notify_admin_move_out?, notify_admin_registration? }
const updatePreferences = async (req, res, next) => {
  try {
    const PREF_FIELDS = fieldsForRole(req.user.role)
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