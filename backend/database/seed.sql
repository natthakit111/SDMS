-- =============================================================================
--  Smart Dormitory Management System (SDMS) — Seed Data
--  ใช้คู่กับ schema.sql (รัน schema.sql ให้จบก่อน แล้วค่อยรันไฟล์นี้)
--
--  ครอบคลุม:
--    1) บัญชีแอดมิน 1 คน
--    2) การตั้งค่าทั่วไปของหอพัก (dorm_settings)
--    3) อัตราค่าน้ำ/ค่าไฟเริ่มต้น (utility_rates)
--
--  ข้อสมมติ: รันบนฐานข้อมูลที่เพิ่งสร้างใหม่ (ตารางว่างทั้งหมด, AUTO_INCREMENT เริ่มที่ 1)
--  ถ้าฐานข้อมูลมีข้อมูลอยู่แล้ว ให้ตรวจสอบ user_id ของแอดมินก่อนรัน utility_rates
--
--  ไฟล์นี้ไม่สร้าง/สลับฐานข้อมูลเอง — รันเข้าฐานข้อมูลเดียวกับที่รัน schema.sql
--  ไปแล้ว (ชื่อฐานข้อมูลเลือกเองได้ตามต้องการ เช่น local ใช้ `sdms`, Railway
--  จะเป็นชื่อที่ Railway auto-generate ให้ เช่น `railway`):
--    mysql -u <user> -p <ชื่อฐานข้อมูล> < seed.sql
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- 1) บัญชีแอดมิน
-- =============================================================================
-- รหัสผ่านเริ่มต้น: ChangeMe@2026  (hash แบบ bcrypt คอสต์ 10 ด้านล่างคือของรหัสนี้จริง)
-- **ต้องเข้าสู่ระบบแล้วเปลี่ยนรหัสผ่านทันทีหลัง deploy จริง**
-- ⚠️ email_verified = 1 ตั้งแต่ seed — บัญชีนี้สร้างโดยระบบตอน deploy ไม่ใช่
-- self-register จึงไม่ต้องผ่าน OTP/ลิงก์ยืนยัน (ถ้าปล่อย default 0 ตาม schema
-- จะ login ไม่ได้เลยตั้งแต่ deploy ครั้งแรก เพราะ admin@example.com เป็นอีเมล
-- ตัวอย่างที่ไม่มีใครเข้าถึงได้จริง ไม่มีทางกดลิงก์ยืนยัน)
INSERT INTO `users`
  (`username`, `password_hash`, `role`, `first_name`, `last_name`, `email`, `phone`, `is_active`, `language`, `password_must_change`, `email_verified`)
VALUES
  ('admin', '$2b$10$CIa3e8kgdro2hhtWUY0y5u6N9p5IXysPqeMLYTNWuE.0GDQcQnO3m', 'admin', 'System', 'Administrator', 'admin@example.com', '0800000000', 1, 'th', 1, 1);

-- =============================================================================
-- 2) การตั้งค่าทั่วไปของหอพัก
-- =============================================================================
-- key ตรงกับ `allowed` array ใน routes/settings.routes.js (PUT /api/settings) ทุกตัว
-- ⚠️ ค่า dorm_address / company_tax_id / admin_phone / promptpay_id ด้านล่าง
-- เป็น placeholder ที่ตั้งใจให้ "ดูปลอมชัดเจน" (เลข 0 ล้วน) ไม่ใช่ข้อมูลจริง
-- ของหอพักไหน — เข้าไปตั้งค่าจริงในแท็บ "หอพัก"/"การเงิน" ของแอปก่อนใช้งานจริงเสมอ
INSERT INTO `dorm_settings` (`setting_key`, `setting_value`) VALUES
  ('dorm_name',           'Smart Dormitory Management System with Automated Notification'),
  ('dorm_address',        'ที่อยู่ตัวอย่าง (แก้เป็นที่อยู่จริงของหอพักในหน้าตั้งค่า)'),
  ('company_tax_id',      '0000000000000'),
  ('admin_phone',         '0000000000'),
  ('admin_email',         'admin@example.com'),
  ('num_floors',          '10'),
  ('currency',            'THB'),
  ('tax_rate',            '0'),
  ('promptpay_type',      'phone'),
  ('promptpay_id',        '0000000000'),
  ('notify_payment',      '1'),
  ('notify_maintenance',  '1'),
  ('notify_overdue',      '1'),
  ('water_billing_type',  'unit');
  -- bank_name / bank_account / bank_account_name / water_flat_rate: เว้นว่างไว้
  -- (optional — ตั้งค่าเองผ่านหน้า Settings ในแอปตามบัญชีธนาคารจริงของหอพัก)

-- =============================================================================
-- 3) อัตราค่าน้ำ/ค่าไฟเริ่มต้น
-- =============================================================================
INSERT INTO `utility_rates` (`utility_type`, `rate_per_unit`, `effective_from`, `created_by`) VALUES
  ('electric', 8.00,  CURDATE(), 1),
  ('water',    18.00, CURDATE(), 1);


SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- จบไฟล์
-- =============================================================================