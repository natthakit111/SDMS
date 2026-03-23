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

// GET /api/tenants  — admin: list all (with optional ?search=)
const getAllTenants = async (req, res, next) => {
  try {
    const { search, inactive } = req.query;
    // inactive=true → ดูผู้เช่าเก่าที่ถูกลบ, ค่าเริ่มต้น → ผู้เช่าปัจจุบัน
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

// POST /api/tenants  — admin only: creates user + tenant in one transaction
const createTenant = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'Validation failed', errors.array());

    const {
      username, password, first_name, last_name,
      id_card_number, phone, email,
      emergency_contact_name, emergency_contact_phone,
    } = req.body;

    if (await UserModel.findByUsername(username))
      return sendBadRequest(res, 'Username is already taken');
    if (await TenantModel.findByIdCard(id_card_number))
      return sendBadRequest(res, 'ID card number is already registered');

    await conn.beginTransaction();

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);
    const [userResult] = await conn.query(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      [username, password_hash, 'tenant']
    );
    const userId = userResult.insertId;

    const [tenantResult] = await conn.query(
      `INSERT INTO tenants
         (user_id, first_name, last_name, id_card_number, phone, email,
          emergency_contact_name, emergency_contact_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, first_name, last_name, id_card_number, phone,
       email || null, emergency_contact_name || null, emergency_contact_phone || null]
    );

    await conn.commit();
    return sendCreated(res, {
      tenant_id: tenantResult.insertId,
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

    // FIX: correct method name is 'update', not 'updateTenant'
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