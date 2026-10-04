/**
 * tests/moveout.approve.test.js
 * ทดสอบ moveOut.controller
 * กฎ: แจ้งย้ายออกล่วงหน้าน้อยกว่า 30 วัน (นับจากวันแจ้ง = created_at ถึงวันย้ายออกจริง)
 *     -> ค่าปรับ 1 เดือนค่าเช่า, net_refund = deposit - fine
 * ไม่เกี่ยวกับว่าย้ายออกก่อนวันสิ้นสุดสัญญากี่วัน
 */
const { pool } = require('../src/config/db');
const { approve, calcDepositRefund } = require('../src/controllers/moveOut.controller');

// res mock ตาม pattern ที่ utils/response.js ใช้: res.status(code).json(payload)
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// ── Unit: สูตรคำนวณล้วนๆ (ไม่แตะ DB) ─────────────────────────────────────────
describe('calcDepositRefund — notice period rule', () => {
  const contract = { end_date: '2099-12-31', rent_amount: 2500, deposit_amount: 5000 };
  const calc = (noticeDate, moveOutDate) =>
    calcDepositRefund(contract, { noticeDate, moveOutDate });

  test('แจ้ง 14 วัน -> ปรับ 1 เดือน', () => {
    const r = calc('2098-01-01', '2098-01-15');
    expect(r.notice_days_given).toBe(14);
    expect(r.fine_amount).toBe(2500);
    expect(r.net_refund).toBe(2500);
    expect(r.fine_reason).toContain('ไม่ครบ 30 วัน');
  });

  test('แจ้งครบ 30 วันพอดี -> ไม่ปรับ', () => {
    const r = calc('2098-01-01', '2098-01-31');
    expect(r.notice_days_given).toBe(30);
    expect(r.fine_amount).toBe(0);
    expect(r.net_refund).toBe(5000);
    expect(r.fine_reason).toBeNull();
  });

  test('แจ้ง 29 วัน -> ปรับ', () => {
    const r = calc('2098-01-01', '2098-01-30');
    expect(r.notice_days_given).toBe(29);
    expect(r.fine_amount).toBe(2500);
  });

  test('แจ้ง ต.ค. ขอออกสิ้น ธ.ค. (สัญญาหมดสิ้น ธ.ค.) -> ไม่ปรับ', () => {
    const r = calcDepositRefund(
      { end_date: '2098-12-31', rent_amount: 2500, deposit_amount: 5000 },
      { noticeDate: '2098-10-05', moveOutDate: '2098-12-31' }
    );
    expect(r.fine_amount).toBe(0);
    expect(r.net_refund).toBe(5000);
  });

  test('ออกก่อนสิ้นสุดสัญญานานมาก แต่แจ้งครบ 30 วัน -> ไม่ปรับ', () => {
    const r = calc('2098-01-01', '2098-03-01');
    expect(r.days_remaining).toBeGreaterThan(30);
    expect(r.fine_amount).toBe(0);
  });

  test('เวลาในวันแจ้ง (เวลาไทย) ไม่ทำให้นับวันเพี้ยน', () => {
    const r = calc(
      new Date('2098-01-01T23:59:00+07:00'),
      new Date('2098-01-31T00:00:00+07:00')
    );
    expect(r.notice_days_given).toBe(30);
    expect(r.fine_amount).toBe(0);
  });

  test('DATE จาก DB (เที่ยงคืนเวลาไทย = 17:00Z วันก่อนหน้า) นับเป็นวันที่ไทยที่ถูกต้อง', () => {
    // mysql2 + timezone '+07:00' คืน DATE 2098-01-31 เป็น 2098-01-30T17:00:00Z
    const r = calc(new Date('2098-01-01T10:00:00+07:00'), new Date('2098-01-30T17:00:00Z'));
    expect(r.notice_days_given).toBe(30);
    expect(r.fine_amount).toBe(0);
  });

  test('ค่าปรับไม่เกินเงินประกัน', () => {
    const r = calcDepositRefund(
      { end_date: '2099-12-31', rent_amount: 8000, deposit_amount: 5000 },
      { noticeDate: '2098-01-01', moveOutDate: '2098-01-05' }
    );
    expect(r.fine_amount).toBe(5000);
    expect(r.net_refund).toBe(0);
  });
});

// ── Integration: approve() ───────────────────────────────────────────────────
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

    // กำหนด created_at (วันแจ้ง) ตายตัว เพื่อให้ผลทดสอบไม่ขึ้นกับวันที่รันเทสต์
    const [moveOutReq] = await pool.query(
      `INSERT INTO move_out_requests (tenant_id, contract_id, room_id, move_out_date, reason, status, created_at)
       VALUES (?, ?, ?, '2098-01-15', 'ทดสอบ', 'pending', '2098-01-01 10:00:00')`,
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

  test('แจ้งล่วงหน้า 14 วัน (ไม่ครบ 30) -> หักค่าปรับ 1 เดือน, คืนส่วนที่เหลือ, ห้องว่าง, สัญญาสิ้นสุด', async () => {
    // ไม่ส่ง actual_checkout_date -> ใช้ move_out_date ของคำร้อง (2098-01-15)
    // วันแจ้ง 2098-01-01 -> ล่วงหน้า 14 วัน
    const req = {
      params: { id: String(requestId) },
      body: { admin_note: 'ok', deduction_extra: 0 },
      user: { user_id: adminUserId },
    };
    const res = mockRes();
    const next = jest.fn();

    await approve(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.deposit_summary.notice_days_given).toBe(14);
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