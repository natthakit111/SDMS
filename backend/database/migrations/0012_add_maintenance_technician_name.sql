-- 0012_add_maintenance_technician_name.sql
-- เพิ่มช่องกรอกชื่อช่าง/ผู้รับผิดชอบแบบข้อความอิสระ แยกต่างหากจาก
-- assigned_to_user_id (ซึ่งผูกกับบัญชี admin ในระบบเท่านั้น ผ่าน FK จริง —
-- ดู 0004_maintenance_assigned_to_fk.sql) เพราะช่างซ่อมจริงหลายกรณีไม่มี
-- บัญชีผู้ใช้ในระบบเลย (ช่างข้างนอกที่จ้างมาเฉพาะงาน) จึงต้องกรอกชื่อเป็น
-- ข้อความธรรมดาได้โดยไม่ต้องสร้างบัญชี admin ปลอมให้
ALTER TABLE `maintenance_requests`
  ADD COLUMN `assigned_technician_name` varchar(100) DEFAULT NULL AFTER `assigned_to_user_id`;
