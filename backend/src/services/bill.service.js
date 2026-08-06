/**
 * services/bill.service.js
 * Core bill calculation logic.
 *
 * Bill formula:
 *   total = rent + (electric_units × electric_rate) + water_amount + other
 *
 * water_amount:
 *   - ถ้า water_billing_type = 'flat'  → ใช้ water_flat_rate จาก dorm_settings
 *   - ถ้า water_billing_type = 'unit'  → ใช้ water_units × water_rate (เดิม)
 */

const MeterModel       = require('../models/meter.model');
const UtilityRateModel = require('../models/utilityRate.model');
const { pool }         = require('../config/db');

/**
 * ดึง setting จาก dorm_settings
 */
const getSetting = async (key) => {
  const [rows] = await pool.query(
    'SELECT setting_value FROM dorm_settings WHERE setting_key = ? LIMIT 1',
    [key]
  );
  return rows[0]?.setting_value ?? null;
};

/**
 * Calculate the bill amounts for a given room and month/year.
 *
 * @param {number} roomId
 * @param {number} month  - 1–12
 * @param {number} year
 * @param {number} rentAmount
 * @param {number} otherAmount
 * @returns {Object}
 */
const calculateBill = async (roomId, month, year, rentAmount, otherAmount = 0) => {
  // ── Electric reading (required) ────────────────────────────
  const electricReading = await MeterModel.findByRoomMonthYear(roomId, 'electric', month, year);
  if (!electricReading) {
    throw new Error(`Electric meter reading not found for room ${roomId} — ${month}/${year}`);
  }

  const electricUnits  = parseFloat(electricReading.units_used) || 0;
  const electricRate   = parseFloat(electricReading.rate_per_unit);
  const electricAmount = +(electricUnits * electricRate).toFixed(2);

  // ── Water — ตรวจว่าเหมาหรือคิดตามหน่วย ────────────────────
  const waterBillingType = (await getSetting('water_billing_type')) || 'unit';

  let waterAmount = 0;
  let waterUnits  = 0;
  let waterRate   = 0;

  if (waterBillingType === 'flat') {
    // เหมาจ่าย — ไม่ต้องมี meter reading
    const flatRate = await getSetting('water_flat_rate');
    waterAmount = +(parseFloat(flatRate || '0')).toFixed(2);
    waterUnits  = 0;
    waterRate   = waterAmount; // เก็บไว้แสดงผล
  } else {
    // คิดตามหน่วย — ต้องมี meter reading
    const waterReading = await MeterModel.findByRoomMonthYear(roomId, 'water', month, year);
    if (!waterReading) {
      throw new Error(`Water meter reading not found for room ${roomId} — ${month}/${year}`);
    }
    waterUnits  = parseFloat(waterReading.units_used) || 0;
    waterRate   = parseFloat(waterReading.rate_per_unit);
    waterAmount = +(waterUnits * waterRate).toFixed(2);
  }

  const totalAmount = +(rentAmount + electricAmount + waterAmount + otherAmount).toFixed(2);

  return {
    rent_amount:      +rentAmount.toFixed(2),
    electric_amount:  electricAmount,
    water_amount:     waterAmount,
    other_amount:     +otherAmount.toFixed(2),
    total_amount:     totalAmount,
    electric_units:   electricUnits,
    water_units:      waterUnits,
    electric_rate:    electricRate,
    water_rate:       waterRate,
    water_billing_type: waterBillingType,
  };
};

/**
 * Calculate default due date: last day of the billing month.
 */
const getDefaultDueDate = (month, year) => {
  const lastDay = new Date(year, month, 0);
  const mm = String(lastDay.getMonth() + 1).padStart(2, '0');
  const dd = String(lastDay.getDate()).padStart(2, '0');
  return `${lastDay.getFullYear()}-${mm}-${dd}`;
};

module.exports = { calculateBill, getDefaultDueDate, getSetting };