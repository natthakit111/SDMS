/**
 * tests/contract.renew.test.js
 * ต่อสัญญาที่หมดอายุ (renewContract flow): update(end_date) + updateStatus('active')
 * เทสนี้ยืนยันว่าสัญญาที่ status='expired' เปลี่ยนกลับเป็น 'active' พร้อม end_date ใหม่ได้ถูกต้อง
 */
const { pool } = require('../src/config/db');
const ContractModel = require('../src/models/contract.model');

describe('Contract renewal (update + updateStatus)', () => {
  let roomId, tenantId, userId, contractId;

  beforeAll(async () => {
    const [room] = await pool.query(
      `INSERT INTO rooms (room_number, floor, room_type, base_rent, status) VALUES ('TEST-RENEW', 99, 'single', 2500, 'occupied')`
    );
    roomId = room.insertId;

    const [user] = await pool.query(
      `INSERT INTO users (username, phone, password_hash, role, is_active) VALUES ('test_renew_user', '0899990001', 'x', 'tenant', 1)`
    );
    userId = user.insertId;

    const [tenant] = await pool.query(
      `INSERT INTO tenants (user_id, first_name, last_name, phone, id_card_number)
       VALUES (?, 'Test', 'Renew', '0899990001', 'RENEWTEST0001')`,
      [userId]
    );
    tenantId = tenant.insertId;

    const [contract] = await pool.query(
      `INSERT INTO contracts (tenant_id, room_id, start_date, end_date, rent_amount, deposit_amount, status)
       VALUES (?, ?, '2098-01-01', '2098-12-31', 2500, 5000, 'expired')`,
      [tenantId, roomId]
    );
    contractId = contract.insertId;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM contracts WHERE contract_id = ?', [contractId]);
    await pool.query('DELETE FROM tenants WHERE tenant_id = ?', [tenantId]);
    await pool.query('DELETE FROM users WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM rooms WHERE room_id = ?', [roomId]);
    await pool.end();
  });

  test('ต่อสัญญา expired -> active พร้อมวันสิ้นสุดใหม่', async () => {
    const affected = await ContractModel.update(contractId, { end_date: '2099-12-31', rent_amount: 2700 });
    expect(affected).toBe(1);

    const statusAffected = await ContractModel.updateStatus(contractId, 'active');
    expect(statusAffected).toBe(1);

    const renewed = await ContractModel.findById(contractId);
    expect(renewed.status).toBe('active');
    expect(Number(renewed.rent_amount)).toBe(2700);
    expect(new Date(renewed.end_date).getFullYear()).toBe(2099);
  });
});
