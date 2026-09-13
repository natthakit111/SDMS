-- 0010_add_registration_verification.sql
-- เพิ่มตารางสำหรับยืนยันอีเมลด้วย OTP 6 หลัก "ก่อน" สร้างบัญชีจริงตอน
-- self-register (สมัครเองผ่านหน้าเว็บ) — อีเมลกลายเป็นบังคับกรอกสำหรับ
-- flow นี้ (ไม่กระทบแอดมินเพิ่มผู้เช่าเอง ที่ยังปล่อยอีเมล optional ได้
-- เหมือนเดิมผ่าน admin/tenants)
--
-- Idempotent: CREATE TABLE IF NOT EXISTS รันซ้ำได้ปลอดภัย

CREATE TABLE IF NOT EXISTS `registration_verifications` (
  `id`                int unsigned NOT NULL AUTO_INCREMENT,
  `email`             varchar(150) NOT NULL,
  `code`              varchar(6)   DEFAULT NULL,
  `code_expires_at`   datetime     DEFAULT NULL,
  `attempts`          tinyint unsigned NOT NULL DEFAULT 0,
  `ticket`            varchar(64)  DEFAULT NULL,
  `ticket_expires_at` datetime     DEFAULT NULL,
  `created_at`        datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_registration_verifications_email` (`email`),
  UNIQUE KEY `uq_registration_verifications_ticket` (`ticket`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
