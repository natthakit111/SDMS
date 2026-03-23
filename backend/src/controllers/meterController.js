/**
 * controllers/meterController.js
 * Admin records monthly water/electric meter readings per room.
 * Optionally uploads a meter photo for evidence.
 */

const { validationResult } = require('express-validator');
const MeterModel       = require('../models/meter.model');
const UtilityRateModel = require('../models/utilityRate.model');
const ContractModel    = require('../models/contract.model');
const { sendSuccess, sendCreated, sendBadRequest, sendNotFound } = require('../utils/response');

// GET /api/meters?room_id=&meter_type=&month=&year=
const getAllReadings = async (req, res, next) => {
  try {
    const { room_id, meter_type, month, year } = req.query;
    const readings = await MeterModel.findAll({ room_id, meter_type, month, year });
    return sendSuccess(res, readings);
  } catch (err) { next(err); }
};

// GET /api/meters/:id
const getReadingById = async (req, res, next) => {
  try {
    const reading = await MeterModel.findById(req.params.id);
    if (!reading) return sendNotFound(res, 'Meter reading not found');
    return sendSuccess(res, reading);
  } catch (err) { next(err); }
};

// GET /api/meters/rooms/:roomId/previous?type=electric
const getPreviousReading = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const meterType  = req.query.type || 'electric';
    const latest = await MeterModel.findLatestByRoomAndType(roomId, meterType);
    return sendSuccess(res, {
      previous_unit: latest ? parseFloat(latest.current_unit) : 0,
      last_recorded: latest ? `${latest.reading_month}/${latest.reading_year}` : null,
    });
  } catch (err) { next(err); }
};

// POST /api/meters
const createReading = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'Validation failed', errors.array());

    const { room_id, meter_type, reading_month, reading_year, current_unit, other_amount } = req.body;
    let { rate_per_unit } = req.body;

    const activeContract = await ContractModel.findActiveByRoom(room_id);
    if (!activeContract) {
      return sendBadRequest(res, `Room ${room_id} has no active contract — cannot record meter`);
    }

    const duplicate = await MeterModel.findByRoomMonthYear(room_id, meter_type, reading_month, reading_year);
    if (duplicate) {
      return res.status(400).json({
        success: false,
        error_code: 'meters.error.alreadyExists',
        message: `A ${meter_type} reading for room ${room_id} in ${reading_month}/${reading_year} already exists.`
      });
    }

    if (!rate_per_unit) {
      const currentRate = await UtilityRateModel.getCurrentRate(meter_type);
      if (!currentRate) {
        return sendBadRequest(res, `No ${meter_type} rate configured. Please set a rate in Utility Rates first.`);
      }
      rate_per_unit = currentRate.rate_per_unit;
    }

    const previousReading = await MeterModel.findLatestByRoomAndType(room_id, meter_type);
    const previous_unit = previousReading ? parseFloat(previousReading.current_unit) : 0;

    if (parseFloat(current_unit) < previous_unit) {
      return sendBadRequest(
        res,
        `Current unit (${current_unit}) cannot be less than previous unit (${previous_unit})`
      );
    }

    // ✅ Cloudinary: req.file.path คือ URL เต็ม ไม่ต้อง replace backslash
    const image_path = req.file ? req.file.path : null;

    const readingId = await MeterModel.create({
      room_id, meter_type,
      reading_month: parseInt(reading_month),
      reading_year:  parseInt(reading_year),
      previous_unit,
      current_unit:  parseFloat(current_unit),
      rate_per_unit: parseFloat(rate_per_unit),
      image_path,
      recorded_by: req.user.user_id,
    });

    const created = await MeterModel.findById(readingId);
    return sendCreated(res, created, 'Meter reading recorded successfully');
  } catch (err) { next(err); }
};

// PUT /api/meters/:id
const updateReading = async (req, res, next) => {
  try {
    const reading = await MeterModel.findById(req.params.id);
    if (!reading) return sendNotFound(res, 'Meter reading not found');

    const { current_unit, rate_per_unit } = req.body;
    // ✅ Cloudinary: req.file.path คือ URL เต็ม ไม่ต้อง replace backslash
    const image_path = req.file ? req.file.path : undefined;

    const updates = {};
    if (current_unit !== undefined) {
      if (parseFloat(current_unit) < parseFloat(reading.previous_unit)) {
        return sendBadRequest(res, `Current unit cannot be less than previous unit (${reading.previous_unit})`);
      }
      updates.current_unit = parseFloat(current_unit);
    }
    if (rate_per_unit !== undefined) updates.rate_per_unit = parseFloat(rate_per_unit);
    if (image_path    !== undefined) updates.image_path = image_path;

    await MeterModel.update(req.params.id, updates);
    const updated = await MeterModel.findById(req.params.id);
    return sendSuccess(res, updated, 'Meter reading updated successfully');
  } catch (err) { next(err); }
};

module.exports = { getAllReadings, getReadingById, getPreviousReading, createReading, updateReading };