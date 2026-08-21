/**
 * tests/payment.guard.test.js
 * กัน regression ของบั๊กยืนยัน/ปฏิเสธการชำระเงินซ้ำได้ ที่แก้ไปใน payment.controller.js
 * โดยเติม WHERE status='pending_verify' ใน PaymentModel.verify — เทสนี้เช็คว่า
 * การเรียกครั้งที่สองบนรายการเดียวกัน (จำลองแอดมินสองคนกดพร้อมกัน) ถูกบล็อกจริง
 */
const { pool } = require('../src/config/db');
const PaymentModel = require('../src/models/payment.model');

describe('PaymentModel.verify guarded UPDATE', () => {
  let conn;
  let paymentId;

  beforeEach(async () => {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [bills] = await conn.query('SELECT bill_id FROM bills LIMIT 1');
    const [tenants] = await conn.query('SELECT tenant_id FROM tenants LIMIT 1');
    if (!bills.length || !tenants.length) {
      throw new Error('ต้องมีอย่างน้อย 1 bill และ 1 tenant ใน DB เพื่อรันเทสนี้');
    }

    const [insertResult] = await conn.query(
      `INSERT INTO payments (bill_id, tenant_id, amount_paid, payment_method, status)
       VALUES (?, ?, 100, 'qr_promptpay', 'pending_verify')`,
      [bills[0].bill_id, tenants[0].tenant_id],
    );
    paymentId = insertResult.insertId;
  });

  afterEach(async () => {
    await conn.rollback();
    conn.release();
  });

  afterAll(async () => {
    await pool.end();
  });

  test('only the first verify call succeeds; the second (duplicate) is blocked', async () => {
    const first = await PaymentModel.verify(paymentId, 1, 'verified', null, conn);
    expect(first).toBe(1);

    const second = await PaymentModel.verify(paymentId, 2, 'rejected', 'dup', conn);
    expect(second).toBe(0);
  });
});
