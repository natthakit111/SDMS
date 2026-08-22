/**
 * controllers/announcementController.js
 * Supports target_floor for floor-specific announcements.
 * getAll now resolves the requesting tenant's own floor (via their active
 * contract/room) and filters the list so a tenant only sees announcements
 * meant for "all floors" or for their own floor.
 *
 * NEW: is_urgent — urgent announcements bypass tenants' notify_announcement
 * mute setting (handled inside TelegramService.broadcastAnnouncement).
 */
const { validationResult } = require('express-validator')
const { pool }          = require('../config/db')
const AnnouncementModel = require('../models/announcement.model')
const TelegramService   = require('../services/telegram.service')
const { sendSuccess, sendCreated, sendBadRequest, sendNotFound } = require('../utils/response')

// ── Helper: find the floor of the room a tenant currently has an active contract on ──
const getTenantFloor = async (userId) => {
  const [rows] = await pool.query(
    `SELECT r.floor
     FROM tenants t
     JOIN contracts c ON c.tenant_id = t.tenant_id AND c.status = 'active'
     JOIN rooms r ON r.room_id = c.room_id
     WHERE t.user_id = ?
     LIMIT 1`,
    [userId]
  )
  return rows[0]?.floor ?? null
}

// ── Helper: does this tenant currently have an active contract at all? ──
// ⚠️ FIX: หน้าฟีดประกาศในแอปเดิมกรองแค่ตาม role/ชั้น ไม่เช็คว่ามีสัญญาเช่า
// ที่ใช้งานอยู่หรือยัง ทำให้ผู้เช่าที่สมัครบัญชีไว้แต่ยังไม่มีสัญญาเห็น
// ประกาศทุกอันได้ ทั้งที่ฝั่ง Telegram (TelegramService.broadcastAnnouncement)
// บังคับต้องมีสัญญา active อยู่แล้วอยู่แล้ว — ทำให้สองฝั่งไม่ตรงกัน
const hasActiveContract = async (userId) => {
  const [rows] = await pool.query(
    `SELECT 1
     FROM tenants t
     JOIN contracts c ON c.tenant_id = t.tenant_id AND c.status = 'active'
     WHERE t.user_id = ?
     LIMIT 1`,
    [userId]
  )
  return rows.length > 0
}

const getAll = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin'

    if (!isAdmin && !(await hasActiveContract(req.user.user_id))) {
      return sendSuccess(res, [])
    }

    const audience = isAdmin ? undefined : 'tenant'
    const tenantFloor = isAdmin ? null : await getTenantFloor(req.user.user_id)

    const items = await AnnouncementModel.findAll({
      target_audience: audience,
      tenant_floor: tenantFloor,
    })
    return sendSuccess(res, items)
  } catch (err) { next(err) }
}

// ใหม่
const getById = async (req, res, next) => {
  try {
    const item = await AnnouncementModel.findById(req.params.id)
    if (!item) return sendNotFound(res, 'ไม่พบประกาศ')

    // ⚠️ FIX: เดิมไม่มีการกรองสิทธิ์เลย ต่างจาก getAll ที่กรอง audience/floor
    // ไว้ — tenant เดา announcement_id แล้วเห็นประกาศที่ไม่ใช่ของตัวเองได้
    if (req.user.role !== 'admin') {
      if (item.target_audience === 'admin') {
        return sendNotFound(res, 'ไม่พบประกาศ')
      }
      if (!(await hasActiveContract(req.user.user_id))) {
        return sendNotFound(res, 'ไม่พบประกาศ')
      }
      if (item.target_floor !== null) {
        const tenantFloor = await getTenantFloor(req.user.user_id)
        if (tenantFloor !== item.target_floor) {
          return sendNotFound(res, 'ไม่พบประกาศ')
        }
      }
    }

    return sendSuccess(res, item)
  } catch (err) { next(err) }
}

const create = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array())

    const { title, content, target_audience, target_floor, is_pinned, is_urgent, expires_at } = req.body
    const id = await AnnouncementModel.create({
      title, content, target_audience, is_pinned,
      target_floor: target_floor ? parseInt(target_floor) : null,
      is_urgent: !!is_urgent,
      published_by: req.user.user_id,
      expires_at,
    })

    const item = await AnnouncementModel.findById(id)

    // Broadcast to tenants via Telegram — respects floor filter, urgent bypasses mute
    if (target_audience !== 'admin') {
      TelegramService.broadcastAnnouncement(
        title, content, target_audience,
        target_floor ? parseInt(target_floor) : null,
        !!is_urgent
      ).catch(() => {})
    }

    return sendCreated(res, item, 'เผยแพร่ประกาศสำเร็จ')
  } catch (err) { next(err) }
}

const update = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array())

    const item = await AnnouncementModel.findById(req.params.id)
    if (!item) return sendNotFound(res, 'ไม่พบประกาศ')
    await AnnouncementModel.update(req.params.id, req.body)
    return sendSuccess(res, await AnnouncementModel.findById(req.params.id), 'อัปเดตประกาศสำเร็จ')
  } catch (err) { next(err) }
}

const remove = async (req, res, next) => {
  try {
    const item = await AnnouncementModel.findById(req.params.id)
    if (!item) return sendNotFound(res, 'ไม่พบประกาศ')
    await AnnouncementModel.remove(req.params.id)
    return sendSuccess(res, null, 'ลบประกาศสำเร็จ')
  } catch (err) { next(err) }
}

module.exports = { getAll, getById, create, update, remove }