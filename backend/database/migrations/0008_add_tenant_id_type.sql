-- 0008_add_tenant_id_type.sql
-- เพิ่มรองรับ "พาสปอร์ต" นอกเหนือจากเลขบัตรประชาชนไทย + flag แยกข้อมูล
-- placeholder (สร้างอัตโนมัติตอนสมัครเอง/OAuth ที่ยังไม่ได้กรอกเลขบัตรจริง)
-- ออกจากเลขบัตรที่แอดมินยืนยันแล้วจริงๆ (เดิมแยกด้วยการเดา prefix string
-- 'REG'/'OAUTH' เท่านั้น ไม่มี flag ในฐานข้อมูล)
--
-- Idempotent: เช็คคอลัมน์ก่อนเพิ่มทุกครั้ง รันซ้ำได้ปลอดภัย

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'id_type'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `tenants` ADD COLUMN `id_type` enum(''thai_id'',''passport'') NOT NULL DEFAULT ''thai_id'' AFTER `id_card_number`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'is_placeholder_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `tenants` ADD COLUMN `is_placeholder_id` tinyint(1) NOT NULL DEFAULT 0 AFTER `id_type`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `tenants` MODIFY COLUMN `id_card_number` varchar(20) NOT NULL;

-- Backfill: record เก่าที่สร้างแบบ placeholder (ไม่เคยผ่านการกรอกเลขบัตรจริง)
-- ยังไม่ถูก mangle ตอนลบ (ไม่ขึ้นต้นด้วย 'DEL') ให้ตั้ง flag ไว้เพื่อให้แอดมิน
-- เห็นว่าต้องยืนยัน/แก้ไขเลขบัตรจริงทีหลัง
UPDATE `tenants`
SET `is_placeholder_id` = 1
WHERE (`id_card_number` LIKE 'REG%' OR `id_card_number` LIKE 'OAUTH%')
  AND `is_placeholder_id` = 0;
