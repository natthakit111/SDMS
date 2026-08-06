/**
 * controllers/tenantController.js
 */

const bcrypt    = require('bcrypt');
const { validationResult } = require('express-validator');
const { pool }  = require('../config/db');
const UserModel   = require('../models/user.model');
const TenantModel = require('../models/tenant.model');
const {
  sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendForbidden,
} = require('../utils/response');

const PLACEHOLDER_ID_CARD_REGEX = /^REG\d{9}$/;

// GET /api/tenants  — admin: list all (with optional ?search=)
const getAllTenants = async (req, res, next) => {
  try {
    const { search, inactive } = req.query;
    const isActive = inactive === 'true' ? false : true;
    const tenants = await TenantModel.findAll({ search: search || null, isActive });
    return sendSuccess(res, tenants);
  } catch (err) { next(err); }
};

// GET /api/tenants/me  — logged-in tenant views own profile
const getMyProfile = async (req, res, next) => {
  try {
    const tenant = await TenantModel.findByUserId(req.user.user_id);
    if (!tenant) return sendNotFound(res, 'Tenant profile not found');
    return sendSuccess(res, tenant);
  } catch (err) { next(err); }
};

// GET /api/tenants/:id  — admin only
const getTenantById = async (req, res, next) => {
  try {
    const tenant = await TenantModel.findById(req.params.id);
    if (!tenant) return sendNotFound(res, 'Tenant not found');
    return sendSuccess(res, tenant);
  } catch (err) { next(err); }
};

// POST /api/tenants  — admin only: creates user + tenant, OR upgrades an
// existing self-registered (placeholder) account if phone OR email already matches
const createTenant = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'Validation failed', errors.array());

    const {
      password, first_name, last_name,
      id_card_number, phone, email,
      emergency_contact_name, emergency_contact_phone,
    } = req.body;

    // username ไม่รับจาก client อีกต่อไป — ใช้เบอร์โทรเสมอ ให้สอดคล้องกับ
    // flow self-register ใน authController.register
    const username = phone;

    // ── ขั้นที่ 1: หา record ที่ผูกกับเบอร์นี้ "หรือ" อีเมลนี้อยู่แล้ว ──
    const matches = await TenantModel.findMatchesByPhoneOrEmail(phone, email);

    let existingTenant = null;

    if (matches.length > 1) {
      const distinctTenantIds = new Set(matches.map(m => m.tenant_id));
      if (distinctTenantIds.size > 1) {
        return sendBadRequest(res, 'PHONE_EMAIL_CONFLICT_DIFFERENT_TENANTS');
      }
      existingTenant = matches[0];
    } else if (matches.length === 1) {
      existingTenant = matches[0];
    }

    // ── ขั้นที่ 2: ถ้าเจอ record เดิม เช็คว่าเป็น "สมัครเองแบบข้อมูลไม่ครบ" หรือของจริง ──
    if (existingTenant) {
      const isPlaceholder = PLACEHOLDER_ID_CARD_REGEX.test(existingTenant.id_card_number);

      if (!isPlaceholder) {
        const conflictField = existingTenant.phone === phone ? 'phone' : 'email';
        return sendBadRequest(
          res,
          conflictField === 'phone' ? 'PHONE_ALREADY_REGISTERED' : 'EMAIL_ALREADY_REGISTERED'
        );
      }

      const idCardConflict = await TenantModel.findIdCardConflictExcluding(id_card_number, existingTenant.tenant_id);
      if (idCardConflict) {
        return sendBadRequest(res, 'ID_CARD_ALREADY_REGISTERED');
      }

      if (phone !== existingTenant.phone) {
        const usernameOwner = await UserModel.findByUsername(phone);
        if (usernameOwner && usernameOwner.user_id !== existingTenant.user_id) {
          return sendBadRequest(res, 'PHONE_ALREADY_REGISTERED');
        }
      }

      // ── อัปเกรด record เดิม แทนการสร้างใหม่ — user_id คงเดิม ──
      await conn.beginTransaction();
      await TenantModel.upgradeSelfRegistered(conn, existingTenant.tenant_id, existingTenant.user_id, {
        first_name, last_name, id_card_number, phone, email,
        emergency_contact_name, emergency_contact_phone,
      });
      await conn.commit();

      return sendCreated(res, {
        tenant_id: existingTenant.tenant_id,
        user_id: existingTenant.user_id,
        username: existingTenant.username,
        full_name: `${first_name} ${last_name}`,
        upgraded_from_self_registration: true,
      }, 'Existing self-registered account upgraded with full tenant info');
    }

    // ── ขั้นที่ 3: ไม่มี record เดิมผูกกับเบอร์/อีเมลนี้เลย — สร้างใหม่ตามปกติ ──
    if (await UserModel.findByUsername(username))
      return sendBadRequest(res, 'PHONE_ALREADY_REGISTERED'); // username ชนกัน = เบอร์นี้มี user อยู่แล้ว
    if (await TenantModel.findByIdCard(id_card_number))
      return sendBadRequest(res, 'ID_CARD_ALREADY_REGISTERED');

    await conn.beginTransaction();

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);
    const userId = await UserModel.createUser(
      { username, first_name, last_name, email, phone, password_hash, role: 'tenant' },
      conn 
    );

    const tenantId = await TenantModel.createFull(conn, userId, {
      first_name, last_name, id_card_number, phone, email,
      emergency_contact_name, emergency_contact_phone,
    });

    await conn.commit();
    return sendCreated(res, {
      tenant_id: tenantId,
      user_id:   userId,
      username,
      full_name: `${first_name} ${last_name}`,
    }, 'Tenant registered successfully');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// PUT /api/tenants/:id  — admin updates tenant info
const updateTenant = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'Validation failed', errors.array());

    const tenant = await TenantModel.findById(req.params.id);
    if (!tenant) return sendNotFound(res, 'Tenant not found');

    if (req.user.role === 'tenant' && tenant.user_id !== req.user.user_id)
      return sendForbidden(res, 'You can only edit your own profile');

    await TenantModel.update(req.params.id, req.body);
    const updated = await TenantModel.findById(req.params.id);
    return sendSuccess(res, updated, 'Tenant profile updated');
  } catch (err) { next(err); }
};

// PUT /api/tenants/me/profile  — tenant updates own profile (safe fields only)
const updateMyProfile = async (req, res, next) => {
  try {
    const tenant = await TenantModel.findByUserId(req.user.user_id);
    if (!tenant) return sendNotFound(res, 'Tenant profile not found');

    const allowedFields = ['phone', 'email', 'emergency_contact_name', 'emergency_contact_phone'];
    const updates = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await TenantModel.update(tenant.tenant_id, updates);
    const updated = await TenantModel.findById(tenant.tenant_id);
    return sendSuccess(res, updated, 'Profile updated successfully');
  } catch (err) { next(err); }
};

// DELETE /api/tenants/:id  — admin soft-deactivates user account
const deleteTenant = async (req, res, next) => {
  try {
    const tenant = await TenantModel.findById(req.params.id);
    if (!tenant) return sendNotFound(res, 'Tenant not found');
    await UserModel.deactivateUser(tenant.user_id);
    return sendSuccess(res, null, 'Tenant account deactivated');
  } catch (err) { next(err); }
};

module.exports = {
  getAllTenants, getMyProfile, getTenantById,
  createTenant, updateTenant, updateMyProfile, deleteTenant,
};