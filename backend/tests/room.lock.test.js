/**
 * tests/room.lock.test.js
 * กัน regression ของบั๊กจองห้องซ้อน (race condition) ที่แก้ไปใน contract.controller.js
 * โดยเติม FOR UPDATE ใน RoomModel.findById — เทสนี้เช็คว่า row lock ทำงานจริง:
 * transaction ที่สองต้องรอ transaction แรก commit/rollback ก่อน ถึงจะอ่านแถวห้องได้
 */
const { pool } = require('../src/config/db');
const RoomModel = require('../src/models/room.model');

describe('RoomModel.findById(id, conn, forUpdate=true)', () => {
  let roomId;

  beforeAll(async () => {
    const [result] = await pool.query(
      `INSERT INTO rooms (room_number, floor, room_type, base_rent, status)
       VALUES ('TEST-LOCK-ROOM', 99, 'single', 1000, 'available')`
    );
    roomId = result.insertId;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM rooms WHERE room_id = ?', [roomId]);
    await pool.end();
  });

  test('second transaction blocks until the first releases the row lock', async () => {
    const conn1 = await pool.getConnection();
    const conn2 = await pool.getConnection();

    try {
      await conn1.beginTransaction();
      await conn2.beginTransaction();

      await RoomModel.findById(roomId, conn1, true);

      let conn2Resolved = false;
      const conn2Promise = RoomModel.findById(roomId, conn2, true).then(() => {
        conn2Resolved = true;
      });

      await new Promise((r) => setTimeout(r, 500));
      expect(conn2Resolved).toBe(false);

      await conn1.rollback();
      await conn2Promise;
      expect(conn2Resolved).toBe(true);

      await conn2.rollback();
    } finally {
      conn1.release();
      conn2.release();
    }
  }, 10000);
});
