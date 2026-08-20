/**
 * controllers/roomController.js
 */

const { validationResult } = require('express-validator');
const RoomModel      = require('../models/room.model');
const ContractModel  = require('../models/contract.model');
const {
  sendSuccess, sendCreated, sendBadRequest, sendNotFound,
} = require('../utils/response');

// GET /api/rooms?status=available&floor=2
const getAllRooms = async (req, res, next) => {
  try {
    const { status, floor } = req.query;
    // Pass as named object — model destructures { status, floor }
    const rooms = await RoomModel.findAll({
      status: status || null,
      floor:  floor  || null,
    });
    return sendSuccess(res, rooms);
  } catch (err) { next(err); }
};

// GET /api/rooms/stats
const getRoomStats = async (req, res, next) => {
  try {
    const stats = await RoomModel.getSummaryStats(); // correct function name
    return sendSuccess(res, stats);
  } catch (err) { next(err); }
};

// GET /api/rooms/:id
const getRoomById = async (req, res, next) => {
  try {
    const room = await RoomModel.findById(req.params.id);
    if (!room) return sendNotFound(res, 'ไม่พบห้องพัก');
    const activeContract = await ContractModel.findActiveByRoom(room.room_id);
    return sendSuccess(res, { ...room, active_contract: activeContract || null });
  } catch (err) { next(err); }
};

// POST /api/rooms
const createRoom = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const { room_number, floor, room_type, area_sqm, base_rent, status, description } = req.body;

    // 💡 แก้ตรงนี้: เปลี่ยนจากส่งข้อความอังกฤษ เป็นส่ง Error Code 'ROOM_DUPLICATE' แทน
    const existing = await RoomModel.findByRoomNumber(room_number);
    if (existing) return sendBadRequest(res, 'ROOM_DUPLICATE');

    const roomId  = await RoomModel.create({ room_number, floor, room_type, area_sqm, base_rent, status, description });
    const newRoom = await RoomModel.findById(roomId);
    return sendCreated(res, newRoom, 'สร้างห้องพักสำเร็จ');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return sendBadRequest(res, 'ROOM_DUPLICATE');
    }
    next(err); 
  }
};

// PUT /api/rooms/:id
const updateRoom = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendBadRequest(res, 'ข้อมูลไม่ถูกต้อง', errors.array());

    const room = await RoomModel.findById(req.params.id);
    if (!room) return sendNotFound(res, 'ไม่พบห้องพัก');

    if (req.body.room_number && req.body.room_number !== room.room_number) {
      const dup = await RoomModel.findByRoomNumber(req.body.room_number);
      if (dup) return sendBadRequest(res, 'ROOM_DUPLICATE');
    }

    if (req.body.status === 'available') {
      const activeContract = await ContractModel.findActiveByRoom(room.room_id);
      if (activeContract) {
        return sendBadRequest(res, 'ไม่สามารถเปลี่ยนสถานะเป็นว่างได้ เนื่องจากห้องนี้มีสัญญาเช่าที่ใช้งานอยู่');
      }
    }

    await RoomModel.update(req.params.id, req.body);
    const updated = await RoomModel.findById(req.params.id);
    return sendSuccess(res, updated, 'แก้ไขห้องพักสำเร็จ');
  } catch (err) { next(err); }
};

// DELETE /api/rooms/:id
const deleteRoom = async (req, res, next) => {
  try {
    const room = await RoomModel.findById(req.params.id);
    if (!room) return sendNotFound(res, 'ไม่พบห้องพัก');

    const activeContract = await ContractModel.findActiveByRoom(room.room_id);
    if (activeContract) {
      return sendBadRequest(res, 'ไม่สามารถลบห้องพักได้ เนื่องจากห้องนี้มีสัญญาเช่าที่ใช้งานอยู่');
    }

    await RoomModel.remove(req.params.id);
    return sendSuccess(res, null, 'ลบห้องพักสำเร็จ');
  } catch (err) { next(err); }
};

module.exports = { getAllRooms, getRoomById, getRoomStats, createRoom, updateRoom, deleteRoom };
