-- 0006_backfill_users_name_from_tenants.sql
-- UserModel.updateProfileFields เดิมเป็น unconditional UPDATE เซ็ต
-- first_name/last_name เป็น NULL ทุกครั้งที่ถูกเรียกโดยไม่มีการส่งชื่อมา
-- (เช่น ตอนแอดมินแก้ไขแค่เบอร์โทร/อีเมลของผู้เช่าผ่าน
-- tenant.controller.js updateTenant) ทำให้ users.first_name/last_name
-- ของผู้เช่าที่เคยถูกแก้ไขข้อมูลก่อนหน้านี้กลายเป็น NULL ไปแล้วจริง
-- (ผู้ใช้เห็นชื่อหายไปตอน login) ดู
-- backend/src/models/user.model.js updateProfileFields ที่แก้เป็น
-- partial update แล้วสำหรับการแก้ไขครั้งใหม่ๆ ต่อจากนี้ — ไฟล์นี้ backfill
-- ข้อมูลเก่าที่เสียไปแล้วย้อนหลัง โดยดึงชื่อกลับมาจากตาราง tenants
-- (ยังคงค่าที่ถูกต้องอยู่ เพราะ TenantModel.update ไม่เคยมีบั๊กนี้)
--
-- ตรวจสอบบน dev DB ก่อนเขียนไฟล์นี้: พบ 3 แถวที่ users.first_name เป็น
-- NULL ทั้งที่ tenants มีชื่อจริงอยู่
--
-- Idempotent: WHERE u.first_name IS NULL เท่านั้น รันซ้ำได้ปลอดภัย
-- ไม่กระทบ users.first_name ที่มีค่าอยู่แล้ว (ไม่ว่าจะถูกหรือผิด)

UPDATE `users` u
JOIN `tenants` t ON t.`user_id` = u.`user_id`
SET
  u.`first_name` = t.`first_name`,
  u.`last_name` = t.`last_name`
WHERE u.`first_name` IS NULL
  AND t.`first_name` IS NOT NULL;
