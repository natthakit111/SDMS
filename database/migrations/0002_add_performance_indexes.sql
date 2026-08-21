-- 0002_add_performance_indexes.sql
-- index ที่ cron job ใช้ query เต็มตารางทุกคืนแต่ไม่มี index รองรับมาก่อน
-- (ปิดบิลเกินกำหนด, หมดอายุสัญญา, แจ้งเตือน telegram)
-- อยู่ใน database/schema.sql อยู่แล้วสำหรับติดตั้งใหม่ — ไฟล์นี้สำหรับ
-- ฐานข้อมูลที่ติดตั้งไปแล้วก่อนหน้านี้ ให้ตามทันโครงสร้างล่าสุด

ALTER TABLE `users`
  ADD KEY `idx_users_telegram_chat_id` (`telegram_chat_id`);

ALTER TABLE `contracts`
  ADD KEY `idx_contracts_status_enddate` (`status`, `end_date`);

ALTER TABLE `bills`
  ADD KEY `idx_bills_status_due` (`status`, `due_date`);
