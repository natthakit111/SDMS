-- 0003_hardening_constraints.sql
-- เสริมความแข็งแรงของ schema เดิม: บังคับ NOT NULL/unique/FK ให้ password_resets,
-- เพิ่ม index กันแจ้งเตือนซ้ำใน notifications_log, เปลี่ยน move_out_requests ไม่ให้
-- ลบ tenant ที่มีคำขอย้ายออกอยู่ทิ้งไปเฉยๆ, และบังคับช่วงเดือน (1-12) ของบิล/มิเตอร์
-- อยู่ใน database/schema.sql อยู่แล้วสำหรับติดตั้งใหม่ — ไฟล์นี้สำหรับ
-- ฐานข้อมูลที่ติดตั้งไปแล้วก่อนหน้านี้ ให้ตามทันโครงสร้างล่าสุด

-- password_resets: เดิมทุกคอลัมน์ nullable, ไม่มี FK ไป users, token index ไม่ unique
ALTER TABLE `password_resets`
  MODIFY COLUMN `user_id` int unsigned NOT NULL,
  MODIFY COLUMN `token` varchar(255) NOT NULL,
  MODIFY COLUMN `expires_at` datetime NOT NULL,
  DROP INDEX `token`,
  ADD UNIQUE KEY `uq_password_resets_token` (`token`),
  ADD KEY `fk_password_resets_user` (`user_id`),
  ADD CONSTRAINT `fk_password_resets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

-- notifications_log: กันสแกนเต็มตารางตอนเช็คว่าแจ้งเตือนบิลนี้/ประเภทนี้ไปหรือยัง
ALTER TABLE `notifications_log`
  ADD KEY `idx_notif_dedup` (`bill_id`, `notification_type`, `status`, `sent_at`);

-- move_out_requests: ห้ามลบ tenant ที่มีคำขอย้ายออกอยู่ทิ้งไปเฉยๆ (เดิม CASCADE ลบประวัติหายไม่รู้ตัว)
-- แยกเป็น 2 ALTER TABLE เพราะ MySQL ไม่ยอมให้ DROP+ADD constraint ชื่อเดียวกันในคำสั่งเดียว
ALTER TABLE `move_out_requests`
  DROP FOREIGN KEY `fk_moveout_tenant`;

ALTER TABLE `move_out_requests`
  ADD CONSTRAINT `fk_moveout_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE RESTRICT;

-- bills / meter_readings: บังคับเดือนต้องอยู่ในช่วง 1-12
ALTER TABLE `bills`
  ADD CONSTRAINT `chk_bills_month` CHECK (`bill_month` BETWEEN 1 AND 12);

ALTER TABLE `meter_readings`
  ADD CONSTRAINT `chk_meter_reading_month` CHECK (`reading_month` BETWEEN 1 AND 12);
