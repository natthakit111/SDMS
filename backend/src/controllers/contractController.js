/**
 * controllers/contractController.js
 */
const { validationResult } = require('express-validator')
const ContractModel = require('../models/contract.model')
const RoomModel     = require('../models/room.model')
const TenantModel   = require('../models/tenant.model')
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
    if (!contract) return sendNotFound(res, 'Contract not found')
    return sendSuccess(res, contract)
  } catch (err) { next(err) }
}

const getMyContract = async (req, res, next) => {
  try {
    const tenant = await TenantModel.findByUserId(req.user.user_id)
    if (!tenant) return sendNotFound(res, 'Tenant profile not found')
    const contract = await ContractModel.findActiveByTenant(tenant.tenant_id)
    if (!contract) return sendNotFound(res, 'No active contract found')
    return sendSuccess(res, contract)
  } catch (err) { next(err) }
}

const createContract = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return sendBadRequest(res, 'Validation failed', errors.array())

    const { tenant_id, room_id, start_date, end_date, rent_amount, deposit_amount, note } = req.body

    const room = await RoomModel.findById(room_id)
    if (!room) return sendNotFound(res, 'Room not found')
    if (room.status !== 'available') return sendBadRequest(res, `Room ${room.room_number} is '${room.status}'`)

    const tenant = await TenantModel.findById(tenant_id)
    if (!tenant) return sendNotFound(res, 'Tenant not found')

    const existing = await ContractModel.findActiveByTenant(tenant_id)
    if (existing) return sendBadRequest(res, `Tenant already has active contract for room ${existing.room_number}`)

    const contractId = await ContractModel.create({
      tenant_id, room_id, start_date, end_date,
      rent_amount: rent_amount || room.base_rent,
      deposit_amount: deposit_amount || 0, note,
    })
    await RoomModel.updateStatus(room_id, 'occupied')

    const newContract = await ContractModel.findById(contractId)
    return sendCreated(res, newContract, 'Contract created — tenant checked in successfully')
  } catch (err) { next(err) }
}

const updateContract = async (req, res, next) => {
  try {
    const contract = await ContractModel.findById(req.params.id)
    if (!contract) return sendNotFound(res, 'Contract not found')
    if (contract.status !== 'active') return sendBadRequest(res, 'Only active contracts can be edited')
    await ContractModel.update(req.params.id, req.body)
    return sendSuccess(res, await ContractModel.findById(req.params.id), 'Contract updated')
  } catch (err) { next(err) }
}

// ✅ NEW: ต่อสัญญาที่หมดอายุแล้ว (admin only, ต่างจาก updateContract ที่ใช้กับสัญญา active)
const renewContract = async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return sendBadRequest(res, 'Validation failed', errors.array())

    const contract = await ContractModel.findById(req.params.id)
    if (!contract) return sendNotFound(res, 'Contract not found')
    if (contract.status !== 'expired') {
      return sendBadRequest(res, 'Only expired contracts can be renewed — use update for active contracts')
    }

    const { end_date, rent_amount } = req.body
    if (!end_date) return sendBadRequest(res, 'end_date is required')

    const newEndDate = new Date(end_date)
    if (Number.isNaN(newEndDate.getTime()) || newEndDate <= new Date()) {
      return sendBadRequest(res, 'end_date must be a valid date in the future')
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
    if (!contract) return sendNotFound(res, 'Contract not found')

    // ✅ รองรับทั้งสัญญา active (ยกเลิกก่อนกำหนด) และ expired (แอดมินเคลียร์ห้องหลังหมดสัญญา)
    if (!['active', 'expired'].includes(contract.status)) {
      return sendBadRequest(res, 'Contract is already terminated')
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

module.exports = {
  getAllContracts, getContractById, getMyContract,
  createContract, updateContract, renewContract, terminateContract,
}