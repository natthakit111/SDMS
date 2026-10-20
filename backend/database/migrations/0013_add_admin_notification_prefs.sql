-- 0013_add_admin_notification_prefs.sql
-- ให้ admin เชื่อม Telegram ของตัวเองได้แบบเดียวกับผู้เช่า และเลือกเปิด/ปิด
-- การแจ้งเตือนฝั่ง admin แยกตามประเภท เดิมแจ้งเตือนฝั่ง admin ส่งไปที่
-- ADMIN_TELEGRAM_CHAT_ID (env) chat เดียว ตอนนี้ส่งหา admin ทุกคนที่ผูก
-- Telegram ไว้แทน (env ยังใช้เป็นตัวสำรองเมื่อยังไม่มี admin คนไหนผูก)
-- คอลัมน์พวกนี้ไม่มีผลกับบัญชีผู้เช่า
ALTER TABLE `users`
  ADD COLUMN `notify_admin_payment`      tinyint NOT NULL DEFAULT '1' COMMENT 'admin: แจ้งเตือนสลิปชำระเงินใหม่' AFTER `notify_announcement`,
  ADD COLUMN `notify_admin_maintenance`  tinyint NOT NULL DEFAULT '1' COMMENT 'admin: แจ้งเตือนคำร้องแจ้งซ่อมใหม่' AFTER `notify_admin_payment`,
  ADD COLUMN `notify_admin_move_out`     tinyint NOT NULL DEFAULT '1' COMMENT 'admin: แจ้งเตือนคำร้องขอย้ายออกใหม่' AFTER `notify_admin_maintenance`,
  ADD COLUMN `notify_admin_registration` tinyint NOT NULL DEFAULT '1' COMMENT 'admin: แจ้งเตือนผู้เช่าสมัครบัญชีใหม่' AFTER `notify_admin_move_out`;
