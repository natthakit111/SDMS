/**
 * controllers/contractController.js
 */
const { validationResult } = require('express-validator')
const path = require('path')
const fs = require('fs')
const { pool }       = require('../config/db')
const ContractModel = require('../models/contract.model')
const RoomModel     = require('../models/room.model')
const TenantModel   = require('../models/tenant.model')
const DepositModel  = require('../models/deposit.model')
const { sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendForbidden } = require('../utils/response')

const getAllContracts = async (req, res, next) => {
  try {
    const { status, tenant_id, room_id } = req.query
    const contracts = await ContractModel.findAll({ status, tenant_id, room_id })
    return sendSuccess(res, contracts)
  } catch (err) { next(err) }
}

const getContractById = async (req, res, next) => {
  try {
    const contract = await ContractModel.findById(req.params.id)
    if (!contract) return sendNotFound(res, 'ไม่พบสัญญาเช่านี้')
    return sendSuccess(res, contract)
  } catch (err) { next(err) }
}

const getMyContract = async (req, res, next) => {
  try {
    const tenant = await TenantModel.findByUserId(req.user.user_id)
    if (!tenant) return sendNotFound(res, 'ไม่พบข้อมูลผู้เช่า')
    const contract = await ContractModel.findActiveByTenant(tenant.tenant_id)
    if (!contract) return sendNotFound(res, 'ไม่พบสัญญาเช่าที่ใช้งานอยู่')
    return sendSuccess(res, contract)
  } catch (err) { next(err) }
}

const createContract = async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      conn.release()
      return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง', errors.array())
    }

    const { tenant_id, room_id, start_date, end_date, rent_amount, deposit_amount, note, tenant_id_card } = req.body                                                                                       

    const room = await RoomModel.findById(room_id)
    if (!room) { conn.release(); return sendNotFound(res, 'ไม่พบห้องพักนี้') }
    if (room.status !== 'available') {
      conn.release()
      return sendBadRequest(res, `ห้อง ${room.room_number} มีสถานะ '${room.status}' ไม่สามารถทำสัญญาได้`)
    }

    const tenant = await TenantModel.findById(tenant_id)
    if (!tenant) { conn.release(); return sendNotFound(res, 'ไม่พบข้อมูลผู้เช่ารายนี้') }

    const existing = await ContractModel.findActiveByTenant(tenant_id)
    if (existing) {
      conn.release()
      return sendBadRequest(res, `ผู้เช่ารายนี้มีสัญญาที่ใช้งานอยู่แล้วสำหรับห้อง ${existing.room_number}`)
    }

    const finalDeposit = deposit_amount || 0

    await conn.beginTransaction()

    if (tenant_id_card && tenant_id_card.trim() && tenant_id_card.trim() !== tenant.id_card_number) {
      const idCard = tenant_id_card.trim()
      const conflict = await TenantModel.findIdCardConflictExcluding(idCard, tenant_id)
      if (conflict) {
        await conn.rollback()
        conn.release()
        return sendBadRequest(res, 'เลขประจำตัวประชาชนนี้ถูกใช้กับผู้เช่ารายอื่นแล้ว')
      }
      await TenantModel.update(tenant_id, { id_card_number: idCard }, conn)
    }

    const contractId = await ContractModel.create({
      tenant_id, room_id, start_date, end_date,
      rent_amount: rent_amount || room.base_rent,
      deposit_amount: finalDeposit, note,
    }, conn)

    await RoomModel.updateStatus(room_id, 'occupied', conn)

    if (finalDeposit > 0) {
      await DepositModel.create({
        contract_id: contractId,
        tenant_id,
        total_deposit: finalDeposit,
      }, conn)
    }

    await conn.commit()

    const newContract = await ContractModel.findById(contractId)
    return sendCreated(res, newContract, 'Contract created — tenant checked in successfully')
  } catch (err) {
    await conn.rollback()
    next(err)
  } finally {
    conn.release()
  }
}

const updateContract = async (req, res, next) => {
  try {
    const contract = await ContractModel.findById(req.params.id)
    if (!contract) return sendNotFound(res, 'ไม่พบสัญญาเช่านี้')
    if (contract.status !== 'active') return sendBadRequest(res, 'แก้ไขได้เฉพาะสัญญาที่ใช้งานอยู่เท่านั้น')
    await ContractModel.update(req.params.id, req.body)
    return sendSuccess(res, await ContractModel.findById(req.params.id), 'แก้ไขสัญญาสำเร็จ')
  } catch (err) { next(err) }
}

// ✅ NEW: ต่อสัญญาที่หมดอายุแล้ว (admin only, ต่างจาก updateContract ที่ใช้กับสัญญา active)
const renewContract = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง', errors.array())

    const contract = await ContractModel.findById(req.params.id)
    if (!contract) return sendNotFound(res, 'ไม่พบสัญญาเช่านี้')
    if (contract.status !== 'expired') {
      return sendBadRequest(res, 'ต่อสัญญาได้เฉพาะสัญญาที่หมดอายุแล้วเท่านั้น — สัญญาที่ใช้งานอยู่ให้ใช้การแก้ไขแทน')
    }

    const { end_date, rent_amount } = req.body
    if (!end_date) return sendBadRequest(res, 'กรุณาระบุวันสิ้นสุดสัญญา')

    const newEndDate = new Date(end_date)
    if (Number.isNaN(newEndDate.getTime()) || newEndDate <= new Date()) {
      return sendBadRequest(res, 'วันสิ้นสุดสัญญาต้องเป็นวันที่ถูกต้องและอยู่ในอนาคต')
    }

    await ContractModel.update(req.params.id, {
      end_date,
      ...(rent_amount ? { rent_amount } : {}),
    })
    await ContractModel.updateStatus(req.params.id, 'active')

    const renewed = await ContractModel.findById(req.params.id)
    return sendSuccess(res, renewed, `ต่อสัญญาสำเร็จ — ห้อง ${renewed.room_number} มีผลถึง ${end_date}`)
  } catch (err) { next(err) }
}

const terminateContract = async (req, res, next) => {
  try {
    const contract = await ContractModel.findById(req.params.id)
    if (!contract) return sendNotFound(res, 'ไม่พบสัญญาเช่านี้')

    // ✅ รองรับทั้งสัญญา active (ยกเลิกก่อนกำหนด) และ expired (แอดมินเคลียร์ห้องหลังหมดสัญญา)
    if (!['active', 'expired'].includes(contract.status)) {
      return sendBadRequest(res, 'สัญญานี้ถูกยกเลิกไปแล้ว')
    }

    // ✅ Tenant can only terminate their OWN active contract
    if (req.user.role === 'tenant') {
      if (contract.status !== 'active') {
        return sendForbidden(res, 'ไม่สามารถแจ้งย้ายออกสำหรับสัญญาที่หมดอายุแล้วได้ กรุณาติดต่อแอดมิน')
      }
      const tenant = await TenantModel.findByUserId(req.user.user_id)
      if (!tenant || tenant.tenant_id !== contract.tenant_id) {
        return sendForbidden(res, 'คุณสามารถแจ้งย้ายออกได้เฉพาะสัญญาของตัวเองเท่านั้น')
      }
    }

    const checkoutDate  = req.body.checkout_date ? new Date(req.body.checkout_date) : new Date()
    const endDate       = new Date(contract.end_date)
    const deposit       = parseFloat(contract.deposit_amount || 0)
    const rent          = parseFloat(contract.rent_amount || 0)
    const daysRemaining = Math.ceil((endDate - checkoutDate) / (1000 * 60 * 60 * 24))
    // หมดสัญญาไปแล้ว (daysRemaining <= 0) ไม่ถือว่าออกก่อนกำหนด จึงไม่มีค่าปรับ
    const fine_amount   = daysRemaining > 30 ? rent : 0
    const net_refund    = Math.max(0, deposit - fine_amount)

    await ContractModel.updateStatus(req.params.id, 'terminated')
    await RoomModel.updateStatus(contract.room_id, 'available')

    return sendSuccess(res, {
      contract_id:    contract.contract_id,
      room_number:    contract.room_number,
      tenant_name:    contract.tenant_name,
      checkout_date:  checkoutDate.toISOString().split('T')[0],
      end_date:       contract.end_date,
      days_remaining: daysRemaining,
      deposit_amount: deposit,
      fine_amount,
      fine_reason:    fine_amount > 0 ? `ออกก่อนสัญญา ${daysRemaining} วัน (มีค่าปรับ 1 เดือน)` : null,
      deposit_refund: deposit,
      net_refund,
      message:        `Check-out สำเร็จ — คืนเงินมัดจำ ${net_refund.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`,
    }, `Check-out สำเร็จ — ห้อง ${contract.room_number} ว่างแล้ว`)
  } catch (err) { next(err) }
}

// ✅ NEW: Admin อัปโหลดไฟล์สัญญา (PDF/Word) แนบเข้ากับ contract ที่มีอยู่
const uploadContractFile = async (req, res, next) => {
  try {
    if (!req.file) return sendBadRequest(res, 'กรุณาแนบไฟล์สัญญา')
    const contract = await ContractModel.findById(req.params.id)
    if (!contract) return sendNotFound(res, 'ไม่พบสัญญาเช่านี้')

    // ลบไฟล์เก่าถ้ามี ป้องกันไฟล์ค้างใน disk
    if (contract.contract_file) {
      const oldPath = path.join(__dirname, '../../uploads/contracts', path.basename(contract.contract_file))
      fs.unlink(oldPath, () => {})
    }

    await ContractModel.update(req.params.id, { contract_file: req.file.filename })
    const updated = await ContractModel.findById(req.params.id)
    return sendSuccess(res, updated, 'อัปโหลดไฟล์สัญญาสำเร็จ')
  } catch (err) { next(err) }
}

// ✅ NEW: ดาวน์โหลดไฟล์สัญญาจริง (admin ดูได้ทุกฉบับ / tenant ดูได้เฉพาะของตัวเอง)
const downloadContractFile = async (req, res, next) => {
  try {
    const contract = await ContractModel.findById(req.params.id)
    if (!contract) return sendNotFound(res, 'ไม่พบสัญญาเช่านี้')
    if (!contract.contract_file) return sendNotFound(res, 'ยังไม่มีไฟล์สัญญาสำหรับสัญญานี้')

    // tenant ดูได้เฉพาะสัญญาของตัวเองเท่านั้น
    if (req.user.role === 'tenant') {
      const tenant = await TenantModel.findByUserId(req.user.user_id)
      if (!tenant || tenant.tenant_id !== contract.tenant_id) {
        return sendForbidden(res, 'คุณไม่มีสิทธิ์เข้าถึงไฟล์สัญญานี้')
      }
    }

    const filePath = path.join(__dirname, '../../uploads/contracts', path.basename(contract.contract_file))
    if (!fs.existsSync(filePath)) return sendNotFound(res, 'ไม่พบไฟล์สัญญาในระบบ')

    return res.download(
      filePath,
      `contract_CNT${String(contract.contract_id).padStart(3, '0')}${path.extname(filePath)}`
    )
  } catch (err) { next(err) }
}

module.exports = {
  getAllContracts, getContractById, getMyContract,
  createContract, updateContract, renewContract, terminateContract,
  uploadContractFile, downloadContractFile,
}