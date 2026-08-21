/**
 * tests/moveout.approve.test.js
 * ทดสอบ moveOut.controller.approve() แบบ integration เต็มรูปแบบ (mock เฉพาะ req/res)
 * ยืนยันสูตรคำนวณเงินประกันคืน (calcDepositRefund ภายในไฟล์เดียวกัน ไม่ได้ export แยก):
 * ออกก่อนกำหนดเกิน 30 วัน -> โดนค่าปรับ 1 เดือนค่าเช่า, net_refund = deposit - fine
 */
const { pool } = require('../src/config/db');
const { approve } = require('../src/controllers/moveOut.controller');

// res mock ตาม pattern ที่ utils/response.js ใช้: res.status(code).json(payload)
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('moveOut.controller.approve — deposit refund calculation', () => {
  let roomId, adminUserId, tenantUserId, tenantId, contractId, depositId, requestId;

  beforeAll(async () => {
    const [room] = await pool.query(
      `INSERT INTO rooms (room_number, floor, room_type, base_rent, status) VALUES ('TEST-MOVEOUT', 99, 'single', 2500, 'occupied')`
    );
    roomId = room.insertId;

    const [admin] = await pool.query(
      `INSERT INTO users (username, phone, password_hash, role, is_active) VALUES ('test_moveout_admin', '0899990002', 'x', 'admin', 1)`
    );
    adminUserId = admin.insertId;

    const [tenantUser] = await pool.query(
      `INSERT INTO users (username, phone, password_hash, role, is_active) VALUES ('test_moveout_tenant', '0899990003', 'x', 'tenant', 1)`
    );
    tenantUserId = tenantUser.insertId;

    const [tenant] = await pool.query(
      `INSERT INTO tenants (user_id, first_name, last_name, phone, id_card_number)
       VALUES (?, 'Test', 'MoveOut', '0899990003', 'MOVEOUTTEST01')`,
      [tenantUserId]
    );
    tenantId = tenant.insertId;

    // end_date ไกลจากวันนี้มาก (>30 วัน) เพื่อให้ daysRemaining > 30 -> เข้าเงื่อนไขค่าปรับ
    const [contract] = await pool.query(
      `INSERT INTO contracts (tenant_id, room_id, start_date, end_date, rent_amount, deposit_amount, status)
       VALUES (?, ?, '2098-01-01', '2099-12-31', 2500, 5000, 'active')`,
      [tenantId, roomId]
    );
    contractId = contract.insertId;

    const [deposit] = await pool.query(
      `INSERT INTO deposits (contract_id, tenant_id, total_deposit, status) VALUES (?, ?, 5000, 'holding')`,
      [contractId, tenantId]
    );
    depositId = deposit.insertId;

    const [moveOutReq] = await pool.query(
      `INSERT INTO move_out_requests (tenant_id, contract_id, room_id, move_out_date, reason, status)
       VALUES (?, ?, ?, '2098-06-01', 'ทดสอบ', 'pending')`,
      [tenantId, contractId, roomId]
    );
    requestId = moveOutReq.insertId;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM deposits WHERE deposit_id = ?', [depositId]);
    await pool.query('DELETE FROM move_out_requests WHERE request_id = ?', [requestId]);
    await pool.query('DELETE FROM contracts WHERE contract_id = ?', [contractId]);
    await pool.query('DELETE FROM tenants WHERE tenant_id = ?', [tenantId]);
    await pool.query('DELETE FROM users WHERE user_id IN (?, ?)', [adminUserId, tenantUserId]);
    await pool.query('DELETE FROM rooms WHERE room_id = ?', [roomId]);
    await pool.end();
  });

  test('อนุมัติย้ายออกก่อนกำหนด -> หักค่าปรับ 1 เดือน, คืนเงินประกันส่วนที่เหลือ, ห้องว่าง, สัญญาสิ้นสุด', async () => {
    const req = {
      params: { id: String(requestId) },
      body: { admin_note: 'ok', deduction_extra: 0, actual_checkout_date: '2098-01-15' },
      user: { user_id: adminUserId },
    };
    const res = mockRes();
    const next = jest.fn();

    await approve(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.deposit_summary.fine_amount).toBe(2500);
    expect(payload.data.deposit_summary.refund_amount).toBe(2500);

    const [contractRows] = await pool.query('SELECT status FROM contracts WHERE contract_id = ?', [contractId]);
    expect(contractRows[0].status).toBe('terminated');

    const [roomRows] = await pool.query('SELECT status FROM rooms WHERE room_id = ?', [roomId]);
    expect(roomRows[0].status).toBe('available');

    const [depositRows] = await pool.query('SELECT status, deduction, refund_amount FROM deposits WHERE deposit_id = ?', [depositId]);
    expect(depositRows[0].status).toBe('refunded');
    expect(Number(depositRows[0].deduction)).toBe(2500);
    expect(Number(depositRows[0].refund_amount)).toBe(2500);
  });
});
