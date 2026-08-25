-- =============================================================================
--  CI-only fixture data — ใช้เฉพาะใน GitHub Actions (.github/workflows/ci.yml)
--  เพื่อรัน backend/tests/*.test.js เท่านั้น ห้ามรันไฟล์นี้กับฐานข้อมูลจริง
--
--  รันต่อจาก schema.sql + seed.sql เสมอ (ต้องมี rooms จาก seed.sql อยู่แล้ว)
--  เติม tenant + contract + bill ขั้นต่ำ 1 ชุด เพราะ seed.sql ปกติมีแค่ admin/
--  settings/rates/rooms — ไม่มี tenant/contract/bill ซึ่ง payment.guard.test.js
--  ต้องมีอย่างน้อย 1 bill และ 1 tenant ถึงจะรันได้ (ดู error message ในไฟล์นั้น)
-- =============================================================================

USE `sdms`;

INSERT INTO `users`
  (`username`, `password_hash`, `role`, `first_name`, `last_name`, `email`, `phone`, `is_active`, `language`, `password_must_change`)
VALUES
  ('ci_tenant', '$2b$10$CIa3e8kgdro2hhtWUY0y5u6N9p5IXysPqeMLYTNWuE.0GDQcQnO3m', 'tenant', 'CI', 'Tenant', 'ci_tenant@example.com', '0810000001', 1, 'th', 0);
SET @ci_user_id = LAST_INSERT_ID();

INSERT INTO `tenants` (`user_id`, `first_name`, `last_name`, `id_card_number`, `phone`, `email`)
VALUES (@ci_user_id, 'CI', 'Tenant', '1111111111111', '0810000001', 'ci_tenant@example.com');
SET @ci_tenant_id = LAST_INSERT_ID();

SET @ci_room_id = (SELECT `room_id` FROM `rooms` WHERE `room_number` = '101' LIMIT 1);
UPDATE `rooms` SET `status` = 'occupied' WHERE `room_id` = @ci_room_id;

INSERT INTO `contracts` (`tenant_id`, `room_id`, `start_date`, `end_date`, `rent_amount`, `deposit_amount`, `status`)
VALUES (@ci_tenant_id, @ci_room_id, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR), 2500.00, 2500.00, 'active');
SET @ci_contract_id = LAST_INSERT_ID();

INSERT INTO `bills`
  (`contract_id`, `room_id`, `bill_month`, `bill_year`, `rent_amount`, `electric_amount`, `water_amount`, `other_amount`, `total_amount`, `due_date`, `status`)
VALUES
  (@ci_contract_id, @ci_room_id, MONTH(CURDATE()), YEAR(CURDATE()), 2500.00, 200.00, 100.00, 0.00, 2800.00, DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'pending');
