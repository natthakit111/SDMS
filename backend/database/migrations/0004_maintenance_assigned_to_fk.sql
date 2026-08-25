-- 0004_maintenance_assigned_to_fk.sql
-- maintenance_requests.assigned_to เดิมเป็น varchar(100) (free text) แต่
-- backend/src/models/maintenance.model.js ทำ LEFT JOIN users u ON
-- mr.assigned_to = u.user_id อยู่แล้ว ซึ่งแทบไม่มีทางแมตช์ข้อมูลจริงเลย
-- เพราะ frontend เดิมส่งเป็นข้อความอิสระผ่านช่องกรอกข้อความธรรมดา
-- เปลี่ยนเป็น assigned_to_user_id int unsigned + FK จริงไปยัง users(user_id)
--
-- ตรวจสอบข้อมูลบน dev DB ก่อนเขียนไฟล์นี้แล้วพบว่า assigned_to ทุกแถวเป็น
-- NULL/ว่างอยู่แล้ว (ยังไม่เคยมีการกรอกใช้งานจริง) จึงไม่ต้อง map ค่าเดิมใดๆ
-- — ถ้าฐานข้อมูลอื่นมีข้อมูล free-text อยู่จริง ให้ตรวจสอบและ map เป็น
-- user_id ที่ถูกต้องด้วยตนเองก่อนรัน DROP COLUMN ด้านล่าง
-- อยู่ใน database/schema.sql อยู่แล้วสำหรับติดตั้งใหม่ — ไฟล์นี้สำหรับ
-- ฐานข้อมูลที่ติดตั้งไปแล้วก่อนหน้านี้ ให้ตามทันโครงสร้างล่าสุด

-- หมายเหตุ: fk_maint_assigned เดิมเป็นแค่ KEY (index) ธรรมดา ไม่เคยเป็น
-- FOREIGN KEY CONSTRAINT จริง จึงไม่ต้อง DROP FOREIGN KEY ก่อน
ALTER TABLE `maintenance_requests`
  DROP INDEX `fk_maint_assigned`,
  DROP COLUMN `assigned_to`,
  ADD COLUMN `assigned_to_user_id` int unsigned DEFAULT NULL AFTER `status`;

ALTER TABLE `maintenance_requests`
  ADD KEY `fk_maint_assigned` (`assigned_to_user_id`);

ALTER TABLE `maintenance_requests`
  ADD CONSTRAINT `fk_maint_assigned` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;
