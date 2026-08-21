/**
 * tests/bill.calculate.test.js
 * calculateBill() คือ core logic คำนวณยอดบิลจากค่ามิเตอร์ + ค่าเช่า — ผิดจุดเดียว
 * กระทบเงินจริงทุกบิลที่ออก เทสนี้ยืนยันสูตรคำนวณและเงื่อนไข error ตรงตามที่ตั้งใจ
 */
const { pool } = require('../src/config/db');
const { calculateBill } = require('../src/services/bill.service');

describe('calculateBill', () => {
  let roomId;
  let originalWaterBillingType;

  beforeAll(async () => {
    // บังคับ water_billing_type = 'unit' ระหว่างเทสนี้ (เทสคำนวณแบบคิดตามหน่วย)
    // เก็บค่าเดิมไว้ restore ตอนจบ ไม่ให้กระทบ dorm_settings จริง
    const [rows] = await pool.query("SELECT setting_value FROM dorm_settings WHERE setting_key = 'water_billing_type'");
    originalWaterBillingType = rows[0]?.setting_value ?? null;
    await pool.query(
      "INSERT INTO dorm_settings (setting_key, setting_value) VALUES ('water_billing_type', 'unit') ON DUPLICATE KEY UPDATE setting_value = 'unit'"
    );

    const [result] = await pool.query(
      `INSERT INTO rooms (room_number, floor, room_type, base_rent, status) VALUES ('TEST-BILL-CALC', 99, 'single', 3000, 'available')`
    );
    roomId = result.insertId;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM meter_readings WHERE room_id = ?', [roomId]);
    await pool.query('DELETE FROM rooms WHERE room_id = ?', [roomId]);
    if (originalWaterBillingType === null) {
      await pool.query("DELETE FROM dorm_settings WHERE setting_key = 'water_billing_type'");
    } else {
      await pool.query(
        "INSERT INTO dorm_settings (setting_key, setting_value) VALUES ('water_billing_type', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
        [originalWaterBillingType, originalWaterBillingType]
      );
    }
    await pool.end();
  });

  test('คำนวณยอดรวมถูกต้องจากค่ามิเตอร์ไฟ+น้ำ+ค่าเช่า+ค่าอื่นๆ', async () => {
    await pool.query(
      `INSERT INTO meter_readings (room_id, meter_type, reading_month, reading_year, previous_unit, current_unit, rate_per_unit)
       VALUES (?, 'electric', 6, 2099, 100, 150, 8)`, // 50 หน่วย x 8 บาท = 400
      [roomId]
    );
    await pool.query(
      `INSERT INTO meter_readings (room_id, meter_type, reading_month, reading_year, previous_unit, current_unit, rate_per_unit)
       VALUES (?, 'water', 6, 2099, 20, 30, 18)`, // 10 หน่วย x 18 บาท = 180
      [roomId]
    );

    const result = await calculateBill(roomId, 6, 2099, 3000, 50);

    expect(result.electric_amount).toBe(400);
    expect(result.water_amount).toBe(180);
    expect(result.rent_amount).toBe(3000);
    expect(result.other_amount).toBe(50);
    // 3000 (เช่า) + 400 (ไฟ) + 180 (น้ำ) + 50 (อื่นๆ) = 3630
    expect(result.total_amount).toBe(3630);
  });

  test('ไม่มีค่ามิเตอร์ไฟของเดือนนั้น ต้อง throw error ชัดเจน', async () => {
    await expect(calculateBill(roomId, 7, 2099, 3000, 0)).rejects.toThrow(
      /Electric meter reading not found/,
    );
  });
});
