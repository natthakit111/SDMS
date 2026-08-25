-- 0007_password_resets_unique_user.sql
-- AUTH-12: ขอลิงก์รีเซ็ตรหัสผ่านซ้ำหลายครั้งติดกัน → "เข้าลิงก์ไหนก็ได้"
-- (ควรจะเป็นแค่ลิงก์ล่าสุดเท่านั้นที่ใช้ได้ ลิงก์เก่าต้องถูกยกเลิกทันที)
--
-- สาเหตุ: passwordReset.model.js createResetToken() เดิมทำ
-- DELETE ...WHERE user_id=? แล้วค่อย INSERT แยกกันคนละ query ไม่ได้ atomic
-- ถ้า user กดขอลิงก์รัวๆ ภายในเวลาใกล้กันมาก 2 request อาจ DELETE
-- (ไม่เจออะไรให้ลบ เพราะยังไม่มีการ INSERT ของอีกฝั่ง) แล้วค่อย INSERT
-- ทับซ้อนกัน กลายเป็นมี token ของ user คนเดียวกันมากกว่า 1 แถวพร้อมกันจริง
-- ทั้งที่ตั้งใจให้เหลือแค่แถวล่าสุดเท่านั้น
--
-- แก้ที่ต้นเหตุ: เพิ่ม UNIQUE KEY บน user_id แล้วเปลี่ยนโค้ดโมเดลไปใช้
-- INSERT ... ON DUPLICATE KEY UPDATE (atomic ระดับ DB จริง กัน race ได้
-- แม้ 2 request มาพร้อมกันเป๊ะ) — ไฟล์นี้แค่จัดการ schema/ข้อมูลเก่า
--
-- ต้อง dedupe ข้อมูลเก่าก่อน เพราะถ้ามี user_id ซ้ำอยู่แล้วจริงในตอนนี้
-- (จาก race condition ที่เพิ่งอธิบาย) การเพิ่ม UNIQUE KEY จะ fail ทันที —
-- เก็บไว้แค่แถวล่าสุด (id มากสุด) ต่อ user_id ลบแถวเก่าที่เหลือทิ้ง
--
-- Idempotent: DELETE มีเงื่อนไขเทียบกับแถวล่าสุดเสมอ, ADD KEY เช็ค
-- information_schema ก่อนว่ายังไม่มีค่อยเพิ่ม รันซ้ำได้ปลอดภัย

DELETE pr1 FROM `password_resets` pr1
INNER JOIN `password_resets` pr2
  ON pr1.`user_id` = pr2.`user_id` AND pr1.`id` < pr2.`id`;

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'password_resets'
    AND INDEX_NAME = 'uq_password_resets_user'
);

SET @ddl = IF(@idx_exists = 0,
  'ALTER TABLE `password_resets` ADD UNIQUE KEY `uq_password_resets_user` (`user_id`), DROP INDEX `fk_password_resets_user`',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
