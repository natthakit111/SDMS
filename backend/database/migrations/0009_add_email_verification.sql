-- 0009_add_email_verification.sql
-- เพิ่มระบบยืนยันอีเมล: ต้องกดลิงก์ยืนยันก่อนถึง login ได้ ถ้าบัญชีนั้นมี
-- อีเมลผูกอยู่ (อีเมล optional ตอนสมัคร — บัญชีที่ไม่มีอีเมลไม่ได้รับผลกระทบ)
--
-- บัญชีที่มีอยู่แล้วในระบบก่อน migration นี้ (รวม admin ที่ seed ไว้) ตั้งเป็น
-- "ยืนยันแล้ว" ทั้งหมด ไม่งั้นจะถูกล็อกออกจากระบบย้อนหลังทันทีที่ deploy
--
-- Idempotent: เช็คคอลัมน์/ตารางก่อนเพิ่มทุกครั้ง รันซ้ำได้ปลอดภัย

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verified'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `email_verified` tinyint(1) NOT NULL DEFAULT 0 AFTER `is_active`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- บัญชีเก่าทั้งหมด (สมัครก่อน migration นี้จะรันบน environment นี้) ถือว่า
-- ยืนยันแล้ว — ไม่งั้น login ไม่ได้เลยทั้งระบบทันทีหลัง deploy
UPDATE `users` SET `email_verified` = 1 WHERE `email_verified` = 0;

CREATE TABLE IF NOT EXISTS `email_verifications` (
  `id`           int unsigned NOT NULL AUTO_INCREMENT,
  `user_id`      int unsigned NOT NULL,
  `token`        varchar(255) NOT NULL,
  `expires_at`   datetime NOT NULL,
  `created_at`   datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email_verifications_token` (`token`),
  UNIQUE KEY `uq_email_verifications_user` (`user_id`),
  CONSTRAINT `fk_email_verifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
