/**
 * models/announcement.model.js
 * Supports target_floor: NULL = all floors, 1/2/3 = specific floor only.
 * findAll now filters by the requesting tenant's own floor when tenant_floor
 * is passed in (announcements with target_floor = NULL still show to everyone).
 */
const { pool } = require('../config/db')

const findAll = async ({ target_audience, is_pinned, tenant_floor } = {}) => {
  let sql = `
    SELECT a.*, u.username AS published_by_name
    FROM announcements a
    JOIN users u ON a.published_by = u.user_id
    WHERE (a.expires_at IS NULL OR a.expires_at >= NOW())
  `
  const params = []
  if (target_audience && target_audience !== 'all') {
    sql += ' AND (a.target_audience = ? OR a.target_audience = "all")'
    params.push(target_audience)
  }
  if (is_pinned !== undefined) { sql += ' AND a.is_pinned = ?'; params.push(is_pinned ? 1 : 0) }
  // NEW: only show floor-scoped announcements to tenants on that floor.
  // Announcements with target_floor IS NULL (i.e. "all floors") always show.
  if (tenant_floor !== undefined && tenant_floor !== null) {
    sql += ' AND (a.target_floor IS NULL OR a.target_floor = ?)'
    params.push(tenant_floor)
  }
  sql += ' ORDER BY a.is_pinned DESC, a.published_at DESC'
  const [rows] = await pool.query(sql, params)
  return rows
}

const findById = async (id) => {
  const [rows] = await pool.query(
    `SELECT a.*, u.username AS published_by_name FROM announcements a
     JOIN users u ON a.published_by = u.user_id WHERE a.announcement_id = ? LIMIT 1`,
    [id]
  )
  return rows[0] || null
}

const create = async ({ title, content, target_audience, target_floor, is_pinned, published_by, expires_at }) => {
  const [result] = await pool.query(
    `INSERT INTO announcements (title, content, target_audience, target_floor, is_pinned, published_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, content, target_audience || 'all', target_floor || null, is_pinned ? 1 : 0, published_by, expires_at || null]
  )
  return result.insertId
}

const update = async (id, fields) => {
  const allowed = ['title', 'content', 'target_audience', 'target_floor', 'is_pinned', 'expires_at']
  const keys = Object.keys(fields).filter(k => allowed.includes(k))
  if (keys.length === 0) return 0
  const sql = `UPDATE announcements SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE announcement_id = ?`
  const [result] = await pool.query(sql, [...keys.map(k => fields[k]), id])
  return result.affectedRows
}

const remove = async (id) => {
  const [result] = await pool.query('DELETE FROM announcements WHERE announcement_id = ?', [id])
  return result.affectedRows
}

module.exports = { findAll, findById, create, update, remove }