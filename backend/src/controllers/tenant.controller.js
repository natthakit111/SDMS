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
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

// GET /api/tenants  — admin: list all (with optional ?search=&page=&limit=)
const getAllTenants = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const { search, inactive, contract_status } = req.query;
    const isActive = inactive === 'true' ? false : true;
    const { page, limit, offset, isPaginated } = parsePagination(req.query);
    const filters = { search: search || null, isActive, contractStatus: contract_status || null };

    const tenants = await TenantModel.findAll({ ...filters, limit, offset });
    if (!isPaginated) return sendSuccess(res, tenants);

    const total = await TenantModel.countAll(filters);
    return sendSuccess(res, { items: tenants, pagination: buildPaginationMeta(page, limit, total) });
  } catch (err) { next(err); }
};

// GET /api/tenants/me  — logged-in tenant views own profile
const getMyProfile = async (req, res, next) => {
  try {
    const tenant = await TenantModel.findByUserId(req.user.user_id);
    if (!tenant) return sendNotFound(res, 'ไม่พบข้อมูลโปรไฟล์ผู้เช่า');
    return sendSuccess(res, tenant);
  } catch (err) { next(err); }
};

// GET /api/tenants/:id  — admin only
const getTenantById = async (req, res, next) => {
  try {
    const tenant = await TenantModel.findById(req.params.id);
    if (!tenant) return sendNotFound(res, 'ไม่พบผู้เช่า');
    return sendSuccess(res, tenant);
  } catch (err) { next(err); }
};

// POST /api/tenants  — admin only: creates user + tenant
// ⚠️ FIX: เดิมถ้าเบอร์/อีเมลตรงกับ tenant ที่ยังเป็น "placeholder" (สมัครเอง
// ผ่าน /register แบบข้อมูลไม่ครบ) ระบบจะเงียบๆ เขียนทับชื่อ-นามสกุล-เลขบัตร
// ของ record เดิมด้วยข้อมูลที่กรอกใหม่ ("อัปเกรด") — แอดมินเผลอกรอกเบอร์ซ้ำ
// ของ tenant คนละคนโดยไม่ตั้งใจ ก็จะไปเขียนทับตัวตนของ tenant เดิมทันที
// โดยไม่มีอะไรเตือน ตอนนี้ตัด behavior นี้ออก — เบอร์/อีเมลซ้ำ reject เสมอ
// ไม่ว่า record เดิมจะเป็น placeholder หรือไม่ก็ตาม ถ้าต้องการเติมข้อมูลให้
// tenant ที่สมัครเองไว้ ให้ใช้ปุ่มแก้ไข (updateTenant) กับ record เดิมแทน
const createTenant = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const {
      password, first_name, last_name,
      id_card_number, phone, email,
      emergency_contact_name, emergency_contact_phone,
    } = req.body;

    // username ไม่รับจาก client อีกต่อไป — ใช้เบอร์โทรเสมอ ให้สอดคล้องกับ
    // flow self-register ใน authController.register
    const username = phone;

    const conflict = await TenantModel.findConflictByPhoneOrEmail(phone, email);
    if (conflict) {
      return sendBadRequest(
        res,
        conflict.phone === phone ? 'PHONE_ALREADY_REGISTERED' : 'EMAIL_ALREADY_REGISTERED'
      );
    }
    if (await UserModel.findByUsername(username))
      return sendBadRequest(res, 'PHONE_ALREADY_REGISTERED'); // username ชนกัน = เบอร์นี้มี user อยู่แล้ว
    // ⚠️ FIX: users.email มี UNIQUE constraint แยกจาก tenants.email — เช็คแค่
    // TenantModel.findConflictByPhoneOrEmail (ตาราง tenants) ไม่พอ ถ้าอีเมล
    // ชนกับบัญชี users อื่นที่ไม่มี tenant record ผูกอยู่ (เช่น อีเมลแอดมิน)
    // จะหลุดไปชน unique constraint ดิบๆ ตอน INSERT แทน โชว์เป็น error กลาง
    if (email && (await UserModel.findByEmail(email)))
      return sendBadRequest(res, 'EMAIL_ALREADY_REGISTERED');
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
    }, 'ลงทะเบียนผู้เช่าสำเร็จ');
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// PUT /api/tenants/:id  — admin updates tenant info
const updateTenant = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const tenant = await TenantModel.findById(req.params.id);
    if (!tenant) return sendNotFound(res, 'ไม่พบผู้เช่า');

    if (req.user.role === 'tenant' && tenant.user_id !== req.user.user_id)
      return sendForbidden(res, 'คุณสามารถแก้ไขได้เฉพาะโปรไฟล์ของตนเอง');

    const { phone, email } = req.body;

    // ⚠️ FIX: เหตุผลเดียวกับ updateMyProfile — sync phone/email ไป users
    // ด้วยเสมอ ไม่ใช่แค่ tenants เพราะ users.username ผูกกับ phone (login)
    await conn.beginTransaction();

    if (phone !== undefined || email !== undefined) {
      await UserModel.updateProfileFields(tenant.user_id, { phone, email }, conn);
    }

    await TenantModel.update(req.params.id, req.body, conn);
    await conn.commit();

    const updated = await TenantModel.findById(req.params.id);
    return sendSuccess(res, updated, 'อัปเดตข้อมูลผู้เช่าสำเร็จ');
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return sendBadRequest(res, 'PHONE_OR_EMAIL_ALREADY_IN_USE');
    }
    next(err);
  } finally {
    conn.release();
  }
};

// PUT /api/tenants/me/profile  — tenant updates own profile (safe fields only)
const updateMyProfile = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const tenant = await TenantModel.findByUserId(req.user.user_id);
    if (!tenant) return sendNotFound(res, 'ไม่พบข้อมูลโปรไฟล์ผู้เช่า');

    const { first_name, last_name, phone, email, emergency_contact_name, emergency_contact_phone } = req.body;

    // ⚠️ FIX: เดิมอัปเดตแค่ tenants table ฝั่งเดียว — phone/email เพี้ยน
    // ออกจาก users table (ที่ใช้เป็น username/login) ไปเรื่อยๆ ทุกครั้งที่
    // tenant แก้โปรไฟล์ตัวเอง ตอนนี้ sync ทั้งสองตารางในธุรกรรมเดียวกัน
    // (รวม first_name/last_name ด้วย — เดิมไม่ส่งไปเลย ทำให้ users.first_name/
    // last_name ถูกเซ็ตเป็น NULL ทุกครั้งที่เรียก endpoint นี้ ใช้ค่าเดิมของ
    // tenant เป็น fallback กันข้อมูลหายถ้าไม่ได้ส่งฟิลด์นั้นมา)
    await conn.beginTransaction();

    if (first_name !== undefined || last_name !== undefined || phone !== undefined || email !== undefined) {
      await UserModel.updateProfileFields(req.user.user_id, {
        firstName: first_name !== undefined ? first_name : tenant.first_name,
        lastName: last_name !== undefined ? last_name : tenant.last_name,
        email: email !== undefined ? email : tenant.email,
        phone: phone !== undefined ? phone : tenant.phone,
      }, conn);
    }

    const tenantUpdates = {};
    if (first_name !== undefined) tenantUpdates.first_name = first_name;
    if (last_name !== undefined) tenantUpdates.last_name = last_name;
    if (phone !== undefined) tenantUpdates.phone = phone;
    if (email !== undefined) tenantUpdates.email = email;
    if (emergency_contact_name !== undefined) tenantUpdates.emergency_contact_name = emergency_contact_name;
    if (emergency_contact_phone !== undefined) tenantUpdates.emergency_contact_phone = emergency_contact_phone;

    if (Object.keys(tenantUpdates).length) {
      await TenantModel.update(tenant.tenant_id, tenantUpdates, conn);
    }

    await conn.commit();

    const updated = await TenantModel.findById(tenant.tenant_id);
    return sendSuccess(res, updated, 'อัปเดตโปรไฟล์สำเร็จ');
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return sendBadRequest(res, 'PHONE_OR_EMAIL_ALREADY_IN_USE');
    }
    next(err);
  } finally {
    conn.release();
  }
};

// DELETE /api/tenants/:id  — admin soft-deactivates user account
const deleteTenant = async (req, res, next) => {
  try {
    const tenant = await TenantModel.findById(req.params.id);
    if (!tenant) return sendNotFound(res, 'ไม่พบผู้เช่า');
    await UserModel.deactivateUser(tenant.user_id);
    return sendSuccess(res, null, 'ปิดใช้งานบัญชีผู้เช่าสำเร็จ');
  } catch (err) { next(err); }
};

module.exports = {
  getAllTenants, getMyProfile, getTenantById,
  createTenant, updateTenant, updateMyProfile, deleteTenant,
};