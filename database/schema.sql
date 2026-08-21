-- =============================================================================
--  Smart Dormitory Management System (SDMS)
--  Database : sdms
--  Engine   : InnoDB | Charset : utf8mb4 | Collation : utf8mb4_unicode_ci
--
--  ไฟล์นี้จัดเรียงตารางใหม่ตามลำดับความสัมพันธ์ (FK dependency order) จริง
--  จึงสามารถรันสร้างฐานข้อมูลได้ตั้งแต่ต้นจนจบโดยไม่ต้องปิด FOREIGN_KEY_CHECKS
--  (แต่ยังคง SET ไว้เพื่อความปลอดภัยเวลารันซ้ำ/deploy ทับของเดิม)
--
--  รวม migration add_performance_indexes.sql เข้ามาแล้ว (index บน status,
--  bill_month/bill_year, payment_method, priority) — ไม่ต้องรันไฟล์ migration
--  แยกอีกถ้า deploy จากไฟล์นี้ตั้งแต่ต้น
--
--  ไฟล์นี้ไม่สร้าง/สลับฐานข้อมูลเอง — ต้องสร้างฐานข้อมูลเปล่าไว้ก่อน แล้วรันไฟล์นี้
--  เข้าไปในฐานข้อมูลนั้นโดยตรง (ชื่อฐานข้อมูลเลือกเองได้ตามต้องการ):
--    mysql -u <user> -p <ชื่อฐานข้อมูล> < database/schema.sql
--  หรือใน MySQL client / Workbench (ต้อง USE ฐานข้อมูลเป้าหมายก่อน):
--    USE <ชื่อฐานข้อมูล>;
--    SOURCE /path/to/database/schema.sql;
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET UNIQUE_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET TIME_ZONE = '+00:00';

-- =============================================================================
-- 1) ผู้ใช้งานระบบ / ผู้เช่า
-- =============================================================================

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `user_id`              int unsigned NOT NULL AUTO_INCREMENT,
  `username`             varchar(50)  NOT NULL,
  `password_hash`        varchar(255) NOT NULL,
  `role`                 enum('admin','tenant') NOT NULL DEFAULT 'tenant',
  `first_name`           varchar(100) DEFAULT NULL,
  `last_name`            varchar(100) DEFAULT NULL,
  `email`                varchar(100) DEFAULT NULL,
  `phone`                varchar(20)  DEFAULT NULL,
  `telegram_chat_id`     bigint       DEFAULT NULL,
  `is_active`            tinyint(1)   NOT NULL DEFAULT '1',
  `oauth_provider`       varchar(20)  DEFAULT NULL COMMENT 'google | telegram',
  `oauth_provider_id`    varchar(100) DEFAULT NULL COMMENT 'provider user id',
  `language`             enum('th','en') NOT NULL DEFAULT 'th',
  `notify_bill`          tinyint NOT NULL DEFAULT '1' COMMENT 'แจ้งเตือนบิลใหม่ / ใกล้ครบกำหนด',
  `notify_overdue`       tinyint NOT NULL DEFAULT '1' COMMENT 'แจ้งเตือนค้างชำระ',
  `notify_maintenance`   tinyint NOT NULL DEFAULT '1' COMMENT 'แจ้งเตือนอัปเดตสถานะแจ้งซ่อม',
  `notify_announcement`  tinyint NOT NULL DEFAULT '1' COMMENT 'แจ้งเตือนประกาศทั่วไป (ไม่รวมประกาศฉุกเฉิน)',
  `created_at`           datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_phone` (`phone`),
  KEY `idx_users_oauth` (`oauth_provider`,`oauth_provider_id`),
  KEY `idx_users_telegram_chat_id` (`telegram_chat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `rooms`;
CREATE TABLE `rooms` (
  `room_id`      int unsigned NOT NULL AUTO_INCREMENT,
  `room_number`  varchar(20)  NOT NULL,
  `floor`        tinyint unsigned NOT NULL,
  `room_type`    varchar(50)  NOT NULL,
  `area_sqm`     decimal(5,2) DEFAULT NULL,
  `base_rent`    decimal(10,2) NOT NULL,
  `status`       enum('available','occupied','maintenance') NOT NULL DEFAULT 'available',
  `description`  text DEFAULT NULL,
  `created_at`   datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`room_id`),
  UNIQUE KEY `uq_rooms_room_number` (`room_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `tenants`;
CREATE TABLE `tenants` (
  `tenant_id`                int unsigned NOT NULL AUTO_INCREMENT,
  `user_id`                  int unsigned NOT NULL,
  `first_name`               varchar(100) NOT NULL,
  `last_name`                varchar(100) NOT NULL,
  `id_card_number`           varchar(13)  NOT NULL,
  `phone`                    varchar(20)  NOT NULL,
  `email`                    varchar(150) DEFAULT NULL,
  `emergency_contact_name`   varchar(200) DEFAULT NULL,
  `emergency_contact_phone`  varchar(20)  DEFAULT NULL,
  `profile_image`            varchar(255) DEFAULT NULL,
  `created_at`               datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`               datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tenant_id`),
  UNIQUE KEY `uq_tenants_user_id` (`user_id`),
  UNIQUE KEY `uq_tenants_id_card_number` (`id_card_number`),
  UNIQUE KEY `uq_tenants_phone` (`phone`),
  UNIQUE KEY `uq_tenants_email` (`email`),
  CONSTRAINT `fk_tenants_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2) สัญญาเช่า / การย้ายออก / เงินประกัน
-- =============================================================================

DROP TABLE IF EXISTS `contracts`;
CREATE TABLE `contracts` (
  `contract_id`      int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id`        int unsigned NOT NULL,
  `room_id`          int unsigned NOT NULL,
  `start_date`       date NOT NULL,
  `end_date`         date NOT NULL,
  `rent_amount`      decimal(10,2) NOT NULL,
  `deposit_amount`   decimal(10,2) NOT NULL DEFAULT '0.00',
  `status`           enum('active','expired','terminated') NOT NULL DEFAULT 'active',
  `contract_file`    varchar(255) DEFAULT NULL,
  `note`             text DEFAULT NULL,
  `created_at`       datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`contract_id`),
  KEY `fk_contracts_tenant` (`tenant_id`),
  KEY `fk_contracts_room` (`room_id`),
  KEY `idx_contracts_status_enddate` (`status`,`end_date`),
  CONSTRAINT `fk_contracts_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`room_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_contracts_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `move_out_requests`;
CREATE TABLE `move_out_requests` (
  `request_id`             int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id`              int unsigned NOT NULL,
  `contract_id`            int unsigned NOT NULL,
  `room_id`                int unsigned NOT NULL,
  `move_out_date`          date NOT NULL,
  `actual_move_out_date`   date DEFAULT NULL COMMENT 'วันที่ย้ายออกจริงที่แอดมินยืนยัน (เช่น หลังตรวจสภาพห้อง) — ใช้คำนวณค่าปรับ/เงินคืนประกัน ไม่ใช้ move_out_date ที่ tenant เสนอ',
  `reason`                 text NOT NULL,
  `status`                 enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `admin_note`             text DEFAULT NULL,
  `reviewed_by`            int unsigned DEFAULT NULL,
  `reviewed_at`            datetime DEFAULT NULL,
  `created_at`             datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_id`),
  KEY `fk_moveout_tenant` (`tenant_id`),
  KEY `fk_moveout_contract` (`contract_id`),
  KEY `fk_moveout_room` (`room_id`),
  KEY `fk_moveout_reviewer` (`reviewed_by`),
  CONSTRAINT `fk_moveout_contract` FOREIGN KEY (`contract_id`) REFERENCES `contracts` (`contract_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_moveout_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_moveout_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`room_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_moveout_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `deposits`;
CREATE TABLE `deposits` (
  `deposit_id`            int unsigned NOT NULL AUTO_INCREMENT,
  `contract_id`           int unsigned NOT NULL,
  `tenant_id`             int unsigned NOT NULL,
  `move_out_request_id`   int unsigned DEFAULT NULL,
  `total_deposit`         decimal(10,2) NOT NULL,
  `deduction`             decimal(10,2) NOT NULL DEFAULT '0.00',
  `deduction_note`        text DEFAULT NULL,
  `refund_amount`         decimal(10,2) DEFAULT NULL,
  `refund_date`           date DEFAULT NULL,
  `status`                enum('holding','refunded') NOT NULL DEFAULT 'holding',
  `processed_by`          int unsigned DEFAULT NULL,
  `created_at`            datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`deposit_id`),
  UNIQUE KEY `uq_deposit_contract` (`contract_id`),
  KEY `fk_deposits_tenant` (`tenant_id`),
  KEY `fk_deposits_moveout` (`move_out_request_id`),
  KEY `fk_deposits_processed_by` (`processed_by`),
  CONSTRAINT `fk_deposits_contract` FOREIGN KEY (`contract_id`) REFERENCES `contracts` (`contract_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_deposits_moveout` FOREIGN KEY (`move_out_request_id`) REFERENCES `move_out_requests` (`request_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_deposits_processed_by` FOREIGN KEY (`processed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_deposits_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3) บิล / การชำระเงิน / มิเตอร์ / ค่าน้ำค่าไฟ
-- =============================================================================

-- bills : รวม index จาก migration: idx_bills_status, idx_bills_month_year
DROP TABLE IF EXISTS `bills`;
CREATE TABLE `bills` (
  `bill_id`           int unsigned NOT NULL AUTO_INCREMENT,
  `contract_id`       int unsigned NOT NULL,
  `room_id`           int unsigned NOT NULL,
  `bill_month`        tinyint unsigned NOT NULL,
  `bill_year`         smallint unsigned NOT NULL,
  `rent_amount`       decimal(10,2) NOT NULL,
  `electric_amount`   decimal(10,2) NOT NULL DEFAULT '0.00',
  `water_amount`      decimal(10,2) NOT NULL DEFAULT '0.00',
  `other_amount`      decimal(10,2) NOT NULL DEFAULT '0.00',
  `total_amount`      decimal(10,2) NOT NULL,
  `due_date`          date NOT NULL,
  `status`            enum('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
  `qr_payload`        text DEFAULT NULL,
  `note`              text DEFAULT NULL,
  `created_at`        datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active_key`        varchar(50) GENERATED ALWAYS AS
                       (CASE WHEN (`status` <> _utf8mb4'cancelled')
                             THEN CONCAT(`room_id`, _utf8mb4'-', `bill_month`, _utf8mb4'-', `bill_year`)
                             ELSE NULL END) STORED
                       COMMENT 'ใช้บังคับ unique ต่อห้อง/เดือน/ปี เฉพาะบิลที่ยังไม่ถูกยกเลิก',
  PRIMARY KEY (`bill_id`),
  UNIQUE KEY `uq_bill_room_month_active` (`active_key`),
  KEY `fk_bills_contract` (`contract_id`),
  KEY `idx_bills_room` (`room_id`),
  KEY `idx_bills_status` (`status`),
  KEY `idx_bills_month_year` (`bill_year`,`bill_month`),
  KEY `idx_bills_status_due` (`status`,`due_date`),
  CONSTRAINT `fk_bills_contract` FOREIGN KEY (`contract_id`) REFERENCES `contracts` (`contract_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_bills_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`room_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payments : รวม index จาก migration: idx_payments_status, idx_payments_method
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `payment_id`       int unsigned NOT NULL AUTO_INCREMENT,
  `bill_id`          int unsigned NOT NULL,
  `tenant_id`        int unsigned NOT NULL,
  `amount_paid`      decimal(10,2) NOT NULL,
  `payment_method`   enum('qr_promptpay','cash','bank_transfer') NOT NULL DEFAULT 'qr_promptpay',
  `slip_image`       varchar(255) DEFAULT NULL,
  `paid_at`          datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_by`      int unsigned DEFAULT NULL,
  `verified_at`      datetime DEFAULT NULL,
  `status`           enum('pending_verify','verified','rejected') NOT NULL DEFAULT 'pending_verify',
  `remark`           text DEFAULT NULL,
  PRIMARY KEY (`payment_id`),
  KEY `fk_payments_bill` (`bill_id`),
  KEY `fk_payments_tenant` (`tenant_id`),
  KEY `fk_payments_verifier` (`verified_by`),
  KEY `idx_payments_status` (`status`),
  KEY `idx_payments_method` (`payment_method`),
  CONSTRAINT `fk_payments_bill` FOREIGN KEY (`bill_id`) REFERENCES `bills` (`bill_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_payments_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_payments_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `meter_readings`;
CREATE TABLE `meter_readings` (
  `reading_id`      int unsigned NOT NULL AUTO_INCREMENT,
  `room_id`         int unsigned NOT NULL,
  `meter_type`      enum('electric','water') NOT NULL,
  `reading_month`   tinyint unsigned NOT NULL,
  `reading_year`    smallint unsigned NOT NULL,
  `previous_unit`   decimal(10,2) NOT NULL DEFAULT '0.00',
  `current_unit`    decimal(10,2) NOT NULL,
  `units_used`      decimal(10,2) GENERATED ALWAYS AS (`current_unit` - `previous_unit`) STORED,
  `rate_per_unit`   decimal(6,2) NOT NULL,
  `image_path`      varchar(255) DEFAULT NULL,
  `recorded_by`     int unsigned DEFAULT NULL,
  `recorded_at`     datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reading_id`),
  UNIQUE KEY `uq_meter_room_month` (`room_id`,`meter_type`,`reading_month`,`reading_year`),
  KEY `fk_meter_user` (`recorded_by`),
  CONSTRAINT `fk_meter_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`room_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_meter_user` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `utility_rates`;
CREATE TABLE `utility_rates` (
  `rate_id`          int unsigned NOT NULL AUTO_INCREMENT,
  `utility_type`     enum('electric','water') NOT NULL,
  `rate_per_unit`    decimal(6,2) NOT NULL,
  `effective_from`   date NOT NULL,
  `created_by`       int unsigned NOT NULL,
  PRIMARY KEY (`rate_id`),
  KEY `fk_rates_user` (`created_by`),
  CONSTRAINT `fk_rates_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4) แจ้งซ่อม / ประกาศ / แจ้งเตือน
-- =============================================================================

-- maintenance_requests : รวม index จาก migration: idx_maintenance_status, idx_maintenance_priority
DROP TABLE IF EXISTS `maintenance_requests`;
CREATE TABLE `maintenance_requests` (
  `request_id`    int unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id`     int unsigned NOT NULL,
  `room_id`       int unsigned NOT NULL,
  `category`      varchar(100) NOT NULL,
  `description`   text NOT NULL,
  `image_path`    varchar(255) DEFAULT NULL,
  `priority`      enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `status`        enum('pending','in_progress','resolved','cancelled') NOT NULL DEFAULT 'pending',
  `assigned_to`   varchar(100) DEFAULT NULL,
  `resolved_at`   datetime DEFAULT NULL,
  `admin_note`    text DEFAULT NULL,
  `created_at`    datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_id`),
  KEY `fk_maint_tenant` (`tenant_id`),
  KEY `fk_maint_room` (`room_id`),
  KEY `fk_maint_assigned` (`assigned_to`),
  KEY `idx_maintenance_status` (`status`),
  KEY `idx_maintenance_priority` (`priority`),
  CONSTRAINT `fk_maint_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`room_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_maint_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `announcements`;
CREATE TABLE `announcements` (
  `announcement_id`   int unsigned NOT NULL AUTO_INCREMENT,
  `title`             varchar(255) NOT NULL,
  `content`           text NOT NULL,
  `target_audience`   enum('all','admin','tenant') NOT NULL DEFAULT 'all',
  `target_floor`      tinyint unsigned DEFAULT NULL,
  `is_pinned`         tinyint(1) NOT NULL DEFAULT '0',
  `published_by`      int unsigned NOT NULL,
  `published_at`      datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at`        datetime DEFAULT NULL,
  `is_urgent`         tinyint NOT NULL DEFAULT '0' COMMENT 'ประกาศฉุกเฉิน - ส่งถึงผู้เช่าทุกคนแม้ตั้งค่าปิดแจ้งเตือนประกาศไว้',
  PRIMARY KEY (`announcement_id`),
  KEY `fk_announce_user` (`published_by`),
  CONSTRAINT `fk_announce_user` FOREIGN KEY (`published_by`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `notifications_log`;
CREATE TABLE `notifications_log` (
  `log_id`              int unsigned NOT NULL AUTO_INCREMENT,
  `user_id`             int unsigned NOT NULL,
  `bill_id`             int unsigned DEFAULT NULL,
  `notification_type`   varchar(50) NOT NULL,
  `message`             text NOT NULL,
  `sent_at`             datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status`              enum('sent','failed') NOT NULL DEFAULT 'sent',
  PRIMARY KEY (`log_id`),
  KEY `fk_notif_user` (`user_id`),
  KEY `fk_notif_bill` (`bill_id`),
  CONSTRAINT `fk_notif_bill` FOREIGN KEY (`bill_id`) REFERENCES `bills` (`bill_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 5) ระบบยืนยันตัวตน / ความปลอดภัย
-- =============================================================================

DROP TABLE IF EXISTS `oauth_exchange_codes`;
CREATE TABLE `oauth_exchange_codes` (
  `code`         varchar(64) NOT NULL,
  `user_id`      int unsigned NOT NULL,
  `expires_at`   datetime NOT NULL,
  `created_at`   timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`code`),
  KEY `fk_oauth_exchange_user` (`user_id`),
  CONSTRAINT `fk_oauth_exchange_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `password_resets`;
CREATE TABLE `password_resets` (
  `id`           int unsigned NOT NULL AUTO_INCREMENT,
  `user_id`      int unsigned DEFAULT NULL,
  `token`        varchar(255) DEFAULT NULL,
  `expires_at`   datetime DEFAULT NULL,
  `created_at`   datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_password_resets_token` (`token`),
  KEY `fk_password_resets_user` (`user_id`),
  CONSTRAINT `fk_password_resets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `telegram_link_tokens`;
CREATE TABLE `telegram_link_tokens` (
  `id`           int unsigned NOT NULL AUTO_INCREMENT,
  `user_id`      int unsigned NOT NULL,
  `token`        varchar(64) NOT NULL,
  `expires_at`   datetime NOT NULL,
  `created_at`   datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_telegram_user_id` (`user_id`),
  UNIQUE KEY `uq_telegram_token` (`token`),
  CONSTRAINT `fk_user_telegram` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 6) การตั้งค่าระบบ
-- =============================================================================

DROP TABLE IF EXISTS `dorm_settings`;
CREATE TABLE `dorm_settings` (
  `setting_key`     varchar(100) NOT NULL,
  `setting_value`   text DEFAULT NULL,
  `updated_at`      datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `settings_audit_log`;
CREATE TABLE `settings_audit_log` (
  `log_id`        int unsigned NOT NULL AUTO_INCREMENT,
  `user_id`       int unsigned NOT NULL COMMENT 'แอดมินที่ทำการแก้ไข',
  `setting_key`   varchar(50) NOT NULL,
  `old_value`     text DEFAULT NULL COMMENT 'ค่าก่อนแก้ (NULL ถ้าเป็นการตั้งค่าครั้งแรก)',
  `new_value`     text NOT NULL,
  `changed_at`    datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `idx_setting_key` (`setting_key`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_changed_at` (`changed_at`),
  CONSTRAINT `fk_settings_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- จบไฟล์
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 1;
SET UNIQUE_CHECKS = 1;