-- 0005_release_deactivated_identity_fields.sql
-- ผู้เช่าที่เคยถูก admin "ลบ" (soft-delete ผ่าน is_active=0) ก่อนหน้านี้
-- ยังค้าง username/phone/email เดิมไว้ในตาราง users และ tenants ซึ่งมี
-- UNIQUE constraint ระดับฐานข้อมูล ทำให้เบอร์/อีเมล/เลขบัตรของบัญชีที่
-- ถูกลบไปแล้วสมัครใหม่ไม่ได้อีกเลยตลอดกาล (ดู
-- backend/src/controllers/tenant.controller.js deleteTenant ที่แก้ให้
-- mangle ค่าพวกนี้ตั้งแต่ตอน deactivate แล้วสำหรับการลบครั้งใหม่ๆ
-- ต่อจากนี้ — ไฟล์นี้ไล่แก้ข้อมูลเก่าที่ถูกลบไปก่อน fix นั้นย้อนหลัง)
--
-- ตรวจสอบบน dev DB ก่อนเขียนไฟล์นี้: พบ users ที่ is_active=0 และยังไม่
-- ถูก mangle (username ไม่ขึ้นต้นด้วย 'deleted_') 17 แถว
--
-- Idempotent: เช็ค NOT LIKE 'deleted_%' ก่อนทุกครั้ง รันซ้ำได้ปลอดภัย
-- ไม่กระทบบัญชี is_active=1 หรือที่ mangle ไปแล้วจากรอบก่อน

UPDATE `users`
SET
  `username` = CONCAT('deleted_', `user_id`),
  `phone` = IF(`phone` IS NULL, NULL, CONCAT('deleted_', `user_id`)),
  `email` = IF(`email` IS NULL, NULL, CONCAT('deleted_', `user_id`, '@deleted.local'))
WHERE `is_active` = 0
  AND `username` NOT LIKE 'deleted_%';

UPDATE `tenants` t
JOIN `users` u ON u.`user_id` = t.`user_id`
SET
  t.`phone` = CONCAT('deleted_', t.`user_id`),
  t.`email` = IF(t.`email` IS NULL, NULL, CONCAT('deleted_', t.`user_id`, '@deleted.local')),
  t.`id_card_number` = CONCAT('DEL', t.`user_id`)
WHERE u.`is_active` = 0
  AND t.`phone` NOT LIKE 'deleted_%';
