/**
 * controllers/meterController.js
 * ผู้ดูแลระบบบันทึกค่ามิเตอร์น้ำ/ไฟรายเดือนของแต่ละห้อง
 * สามารถอัปโหลดรูปมิเตอร์เพื่อใช้เป็นหลักฐานได้
 *
 * ── รูปแบบการตอบกลับ Error ────────────────────────────────────────────────
 * ทุก 4xx response จะมีฟิลด์ `error_code` ที่ตรงกับ key
 * ใน frontend translations (language-context.tsx) โดย frontend จะอ่าน
 * `error_code` ก่อน และเรียก `t(error_code)` เพื่อแสดงข้อความตามภาษา
 * หากไม่พบ key จึงจะใช้ข้อความ `message` ดิบแทน
 * ──────────────────────────────────────────────────────────────────────────
 */

const { validationResult } = require('express-validator');
const MeterModel       = require('../models/meter.model');
const UtilityRateModel = require('../models/utilityRate.model');
const ContractModel    = require('../models/contract.model');
const { sendSuccess, sendCreated, sendBadRequest, sendNotFound } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

// ── helpers ────────────────────────────────────────────────────────────────

/** ส่ง response 400 พร้อม error_code สำหรับรองรับหลายภาษา และข้อความดิบ */
const sendBadRequestCoded = (res, error_code, message) =>
  res.status(400).json({ success: false, error_code, message });

/** ส่ง response 404 พร้อม error_code สำหรับรองรับหลายภาษา และข้อความดิบ */
const sendNotFoundCoded = (res, error_code, message) =>
  res.status(404).json({ success: false, error_code, message });

// ── controllers ────────────────────────────────────────────────────────────

// GET /api/meters?room_id=&meter_type=&month=&year=
const getAllReadings = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const { room_id, meter_type, month, year, search } = req.query;
    const { page, limit, offset, isPaginated } = parsePagination(req.query);
    const filters = { room_id, meter_type, month, year, search };

    const readings = await MeterModel.findAll({ ...filters, limit, offset });
    if (!isPaginated) return sendSuccess(res, readings);

    const total = await MeterModel.countAll(filters);
    return sendSuccess(res, { items: readings, pagination: buildPaginationMeta(page, limit, total) });
  } catch (err) { next(err); }
};

// GET /api/meters/:id
const getReadingById = async (req, res, next) => {
  try {
    const reading = await MeterModel.findById(req.params.id);
    if (!reading)
      return sendNotFoundCoded(res, 'meters.error.notFound', 'ไม่พบข้อมูลการอ่านมิเตอร์');
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
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const { room_id, meter_type, reading_month, reading_year, current_unit, other_amount } = req.body;
    let { rate_per_unit } = req.body;

    // ── 1. ต้องมีสัญญา active ─────────────────────────────────────────────
    const activeContract = await ContractModel.findActiveByRoom(room_id);
    if (!activeContract) {
      return sendBadRequestCoded(
        res,
        'meters.error.noContract',
        `ห้อง ${room_id} ไม่มีสัญญาเช่าที่ใช้งานอยู่ ไม่สามารถบันทึกค่ามิเตอร์ได้`,
      );
    }

    // ── 2. ห้ามบันทึกซ้ำเดือนเดียวกัน ────────────────────────────────────
    const duplicate = await MeterModel.findByRoomMonthYear(room_id, meter_type, reading_month, reading_year);
    if (duplicate) {
      return sendBadRequestCoded(
        res,
        'meters.error.alreadyExists',
        `มีการบันทึกค่ามิเตอร์ประเภท ${meter_type} สำหรับห้อง ${room_id} ในเดือน ${reading_month}/${reading_year} อยู่แล้ว`,
      );
    }

    // ── 3. ต้องมีอัตราค่าไฟ/น้ำ ──────────────────────────────────────────
    if (!rate_per_unit) {
      const currentRate = await UtilityRateModel.getCurrentRate(meter_type);
      if (!currentRate) {
        const errorCode = meter_type === 'water'
          ? 'meters.error.noWaterRate'
          : 'meters.error.noElectricRate';
        return sendBadRequestCoded(
          res,
          errorCode,
          `ยังไม่ได้ตั้งค่าอัตราค่าบริการสำหรับ ${meter_type} กรุณาตั้งค่าอัตราในเมนูอัตราค่าสาธารณูปโภคก่อน`,
        );
      }
      rate_per_unit = currentRate.rate_per_unit;
    }

    // ── 4. เลขปัจจุบันต้องไม่น้อยกว่าก่อนหน้า ───────────────────────────
    const previousReading = await MeterModel.findLatestByRoomAndType(room_id, meter_type);
    const previous_unit = previousReading ? parseFloat(previousReading.current_unit) : 0;

    if (parseFloat(current_unit) < previous_unit) {
      return sendBadRequestCoded(
        res,
        'meters.error.unitLessThanPrev',
        `ค่ามิเตอร์ปัจจุบัน (${current_unit}) ต้องไม่น้อยกว่าค่ามิเตอร์ก่อนหน้า (${previous_unit})`,
      );
    }

    // ✅ Cloudinary: req.file.path คือ URL เต็ม ไม่ต้อง replace backslash
    const image_path = req.file ? req.file.path : null;

    // ⚠️ FIX: มี pre-check findByRoomMonthYear ด้านบนแล้ว (ข้อ 2) แต่ยังมี race
    // condition ได้ (2 request มาพร้อมกันผ่าน pre-check ทั้งคู่) — ตอน INSERT
    // ชนกับ uq_meter_room_month ของจริงจะโยน ER_DUP_ENTRY ดิบไป errorHandler
    // กลาง ซึ่งไม่มี error_code ให้ frontend แปลภาษาได้ จับตรงนี้แล้วตอบด้วย
    // error_code เดียวกับ pre-check
    let readingId;
    try {
      readingId = await MeterModel.create({
        room_id, meter_type,
        reading_month: parseInt(reading_month),
        reading_year:  parseInt(reading_year),
        previous_unit,
        current_unit:  parseFloat(current_unit),
        rate_per_unit: parseFloat(rate_per_unit),
        image_path,
        recorded_by: req.user.user_id,
      });
    } catch (dbErr) {
      if (dbErr.code === 'ER_DUP_ENTRY') {
        return sendBadRequestCoded(
          res,
          'meters.error.alreadyExists',
          `มีการบันทึกค่ามิเตอร์ประเภท ${meter_type} สำหรับห้อง ${room_id} ในเดือน ${reading_month}/${reading_year} อยู่แล้ว`,
        );
      }
      throw dbErr;
    }

    const created = await MeterModel.findById(readingId);
    return sendCreated(res, created, 'บันทึกค่ามิเตอร์สำเร็จ');
  } catch (err) { next(err); }
};

// PUT /api/meters/:id
const updateReading = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const reading = await MeterModel.findById(req.params.id);
    if (!reading)
      return sendNotFoundCoded(res, 'meters.error.notFound', 'ไม่พบข้อมูลการอ่านมิเตอร์');

    const { current_unit, rate_per_unit } = req.body;
    // ✅ Cloudinary: req.file.path คือ URL เต็ม ไม่ต้อง replace backslash
    const image_path = req.file ? req.file.path : undefined;

    const updates = {};
    if (current_unit !== undefined) {
      if (parseFloat(current_unit) < parseFloat(reading.previous_unit)) {
        return sendBadRequestCoded(
          res,
          'meters.error.unitLessThanPrev',
          `ค่ามิเตอร์ปัจจุบันต้องไม่น้อยกว่าค่ามิเตอร์ก่อนหน้า (${reading.previous_unit})`,
        );
      }
      updates.current_unit = parseFloat(current_unit);
    }
    if (rate_per_unit !== undefined) updates.rate_per_unit = parseFloat(rate_per_unit);
    if (image_path    !== undefined) updates.image_path = image_path;

    await MeterModel.update(req.params.id, updates);
    const updated = await MeterModel.findById(req.params.id);
    return sendSuccess(res, updated, 'แก้ไขข้อมูลการอ่านมิเตอร์สำเร็จ');
  } catch (err) { next(err); }
};

// GET /api/meters/available-rooms?month=&year=
const getAvailableRoomsForMeter = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return sendBadRequest(res, 'กรุณาระบุเดือนและปี');
    const rooms = await MeterModel.findAvailableRoomsForMeter(parseInt(month), parseInt(year));
    return sendSuccess(res, rooms);
  } catch (err) { next(err); }
};

module.exports = { getAllReadings, getReadingById, getPreviousReading, createReading, updateReading, getAvailableRoomsForMeter, };