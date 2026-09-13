/**
 * tests/auth.flow.test.js
 * ทดสอบ auth.controller หลัก 3 เรื่อง:
 *   1) register() สร้าง user (role=tenant) + tenant record คู่กันในทรานแซกชันเดียว
 *   2) login() ปฏิเสธรหัสผ่านผิด / บัญชีถูกปิดใช้งาน และคืน password_must_change ตอน login สำเร็จ
 *   3) changePassword() ล้าง password_must_change กลับเป็น 0 หลังเปลี่ยนรหัสผ่านสำเร็จ
 *
 * ใช้ email @gmail.com จริงเพื่อผ่านการเช็ค MX record ใน register() (hasMxRecord)
 */
const bcrypt = require('bcrypt');
const { pool } = require('../src/config/db');
const {
  register, login, changePassword,
  requestRegistrationOtp, verifyRegistrationOtp,
} = require('../src/controllers/auth.controller');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

const uniqueSuffix = Date.now();

describe('auth.controller — register / login / changePassword', () => {
  const registerPhone = `08${String(uniqueSuffix).slice(-8)}`;
  const registerEmail = `sdms.test.${uniqueSuffix}@gmail.com`;
  let registeredUserId;

  afterAll(async () => {
    if (registeredUserId) {
      await pool.query('DELETE FROM tenants WHERE user_id = ?', [registeredUserId]);
      await pool.query('DELETE FROM users WHERE user_id = ?', [registeredUserId]);
    }
    await pool.query('DELETE FROM registration_verifications WHERE email = ?', [registerEmail]);
    await pool.end();
  });

  // ⚠️ self-register เปลี่ยนเป็น 3 ขั้นตอนแล้ว (request-otp → verify-otp
  // ได้ ticket → register) — ทดสอบ end-to-end ทั้ง 3 ขั้น ไม่ได้ mock ข้าม
  // ไปเลยตรงๆ เพื่อให้ยืนยันว่า flow จริงทำงานสอดคล้องกันทั้งสาย
  test('register สร้าง user + tenant สำเร็จ, role ถูกบังคับเป็น tenant เสมอ', async () => {
    const otpReq = { body: { email: registerEmail } };
    const otpRes = mockRes();
    await requestRegistrationOtp(otpReq, otpRes, jest.fn());
    expect(otpRes.status).toHaveBeenCalledWith(200);

    const [[otpRow]] = await pool.query(
      'SELECT code FROM registration_verifications WHERE email = ?',
      [registerEmail]
    );
    expect(otpRow).toBeTruthy();

    const verifyReq = { body: { email: registerEmail, code: otpRow.code } };
    const verifyRes = mockRes();
    await verifyRegistrationOtp(verifyReq, verifyRes, jest.fn());
    expect(verifyRes.status).toHaveBeenCalledWith(200);
    const { ticket } = verifyRes.json.mock.calls[0][0].data;
    expect(ticket).toBeTruthy();

    const req = {
      body: { password: 'TestPass123!', name: 'Test Register', phone: registerPhone, role: 'admin', ticket },
    };
    const res = mockRes();
    const next = jest.fn();

    await register(req, res, next);

    if (next.mock.calls.length) throw next.mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.role).toBe('tenant'); // ⚠️ role จาก body ('admin') ต้องถูกเมิน

    registeredUserId = payload.data.user_id;
    const [userRows] = await pool.query('SELECT role, email_verified FROM users WHERE user_id = ?', [registeredUserId]);
    expect(userRows[0].role).toBe('tenant');
    expect(userRows[0].email_verified).toBe(1); // ผ่าน OTP มาแล้ว ต้องถือว่ายืนยันอีเมลแล้วทันที

    const [tenantRows] = await pool.query('SELECT tenant_id FROM tenants WHERE user_id = ?', [registeredUserId]);
    expect(tenantRows.length).toBe(1);
  }, 15000);

  describe('login', () => {
    let userId;
    const phone = `07${String(uniqueSuffix).slice(-8)}`;
    const plainPassword = 'CorrectPass456!';

    beforeAll(async () => {
      const hash = await bcrypt.hash(plainPassword, 10);
      const [result] = await pool.query(
        `INSERT INTO users (username, phone, password_hash, role, is_active, password_must_change)
         VALUES (?, ?, ?, 'tenant', 1, 1)`,
        [phone, phone, hash]
      );
      userId = result.insertId;
    });

    afterAll(async () => {
      await pool.query('DELETE FROM users WHERE user_id = ?', [userId]);
    });

    test('รหัสผ่านผิด -> 401 AUTH_INVALID_PASSWORD', async () => {
      const req = { body: { username: phone, password: 'WrongPassword' } };
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json.mock.calls[0][0].code).toBe('AUTH_INVALID_PASSWORD');
    });

    test('รหัสผ่านถูก -> สำเร็จ และคืน password_must_change: true', async () => {
      const req = { body: { username: phone, password: plainPassword } };
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload.data.user.password_must_change).toBe(true);
      expect(res.cookie).toHaveBeenCalledWith('token', expect.any(String), expect.any(Object));
    });

    test('บัญชีถูกปิดใช้งาน -> 401 AUTH_ACCOUNT_DISABLED', async () => {
      await pool.query('UPDATE users SET is_active = 0 WHERE user_id = ?', [userId]);
      const req = { body: { username: phone, password: plainPassword } };
      const res = mockRes();
      const next = jest.fn();

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json.mock.calls[0][0].code).toBe('AUTH_ACCOUNT_DISABLED');
    });
  });

  describe('changePassword', () => {
    let userId;
    const currentPassword = 'OldPass789!';
    const newPassword = 'NewPass000!';

    beforeAll(async () => {
      const hash = await bcrypt.hash(currentPassword, 10);
      const [result] = await pool.query(
        `INSERT INTO users (username, phone, password_hash, role, is_active, password_must_change)
         VALUES (?, ?, ?, 'tenant', 1, 1)`,
        [`06${String(uniqueSuffix).slice(-8)}`, `06${String(uniqueSuffix).slice(-8)}`, hash]
      );
      userId = result.insertId;
    });

    afterAll(async () => {
      await pool.query('DELETE FROM users WHERE user_id = ?', [userId]);
    });

    test('เปลี่ยนรหัสผ่านสำเร็จ -> password_must_change ถูกล้างเป็น 0', async () => {
      const req = { user: { user_id: userId }, body: { currentPassword, newPassword } };
      const res = mockRes();
      const next = jest.fn();

      await changePassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const [rows] = await pool.query('SELECT password_must_change, password_hash FROM users WHERE user_id = ?', [userId]);
      expect(rows[0].password_must_change).toBe(0);

      const matches = await bcrypt.compare(newPassword, rows[0].password_hash);
      expect(matches).toBe(true);
    });
  });
});
