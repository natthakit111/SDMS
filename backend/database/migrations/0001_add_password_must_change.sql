-- 0001_add_password_must_change.sql
-- บังคับให้บัญชี admin ที่ seed.sql สร้างต้องเปลี่ยนรหัสผ่านก่อนใช้งาน
-- (ดู backend/src/controllers/auth.controller.js: login/setPasswordHash)
-- อยู่ใน database/schema.sql อยู่แล้วสำหรับติดตั้งใหม่ — ไฟล์นี้สำหรับ
-- ฐานข้อมูลที่ติดตั้งไปแล้วก่อนหน้านี้ ให้ตามทันโครงสร้างล่าสุด

ALTER TABLE `users`
  ADD COLUMN `password_must_change` tinyint(1) NOT NULL DEFAULT '0'
    COMMENT 'บังคับเปลี่ยนรหัสผ่านก่อนใช้งาน (ตั้งเป็น 1 ให้บัญชี admin ที่สร้างด้วยรหัสผ่านตั้งต้นใน seed.sql)'
    AFTER `is_active`;
