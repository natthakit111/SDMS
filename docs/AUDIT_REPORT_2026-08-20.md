# SDMS — Codebase Audit (2026-08-20)

> ตรวจโค้ดจริงทั้ง backend (Express + MySQL), frontend (Next.js) และ database schema / deployment readiness แบบละเอียด ทุกจุดยืนยันจากซอร์สโค้ดจริง ณ commit `fd86f2c`. รายงานนี้เป็นผลตรวจสอบเท่านั้น — ยังไม่มีการแก้โค้ดใดๆ

**สรุป:** Critical 4 · High 9 · Medium 14 · Low 17 (รวม 44 จุด)

ข่าวดี: SQL injection, IDOR, CSRF, การเช็คสิทธิ์เจ้าของข้อมูล ถูกปิดช่องไปแล้วเกือบทั้งหมด (มีคอมเมนต์ยืนยันการแก้ก่อนหน้านี้จริง) และฝั่ง frontend ไม่มี token รั่วไหลไปอยู่ใน localStorage และแนบ CSRF token ครบทุก request ที่แก้ข้อมูล

## ควรแก้ก่อนอันดับแรก

1. **[CRIT]** `database/schema.sql:23-29` — มีตัวอักษรขึ้นบรรทัดใหม่แทรกอยู่ในชื่อฐานข้อมูล ทำให้ตารางทั้งหมดถูกสร้างผิดฐานข้อมูล → deploy ครั้งแรกตาม README จะไม่มีตารางเลย
2. **[CRIT]** ชื่อฐานข้อมูลไม่ตรงกันทั้งสาย: `schema.sql` ใช้ `sdms`, `.env.example`/`db.js` ใช้ `smart_dormitory`
3. **[CRIT]** `contract.controller.js:51-119` — จองห้องซ้อนกันได้ 2 สัญญา (race condition, ไม่มี row lock)
4. **[HIGH]** `contract.controller.js:162-210` (`terminateContract`) — ผู้เช่ายกเลิกสัญญาตัวเองได้ทันที ข้ามขั้นตอนอนุมัติของแอดมิน และไม่ปิดยอดเงินประกัน
5. **[HIGH]** `payment.controller.js:91-121` — verify/reject การชำระเงินไม่มี transaction และไม่ล็อกสถานะ
6. **[HIGH]** ไม่มี automated test เลยทั้ง backend และ frontend ทั้งระบบจัดการเงินจริง
7. **[HIGH]** `register/page.tsx:112` + `auth-context.tsx:172-185` — สมัครสมาชิกสำเร็จแต่ไม่ set session ผู้ใช้โดนเด้งกลับหน้า login
8. **[HIGH]** `admin/settings/page.tsx:190-206` — ตรวจรูปแบบ PromptPay ID หลังบันทึกลงฐานข้อมูลไปแล้ว

---

## 1. ฐานข้อมูล & ความพร้อม Deploy (Critical 3 · High 4 · Medium 7 · Low 6)

### Critical

1. **`database/schema.sql:23-29`** — `CREATE DATABASE`/`USE` มีตัวขึ้นบรรทัดใหม่แทรกในชื่อ ทำให้ชื่อฐานข้อมูลจริงกลายเป็น `sdms\n` ไม่ใช่ `sdms`.
   **Fix:** รวมเป็นบรรทัดเดียว `` CREATE DATABASE IF NOT EXISTS `sdms` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; USE `sdms`; ``

2. **`docs/DEPLOYMENT.md:25,92`, `database/DATABASE.md:3`** — อ้างไฟล์ `database/sdms.sql` ที่ไม่มีอยู่จริง (มีแต่ `schema.sql`).
   **Fix:** แก้ทั้งสองจุดให้ชี้ไป `database/schema.sql`

3. **ชื่อฐานข้อมูลไม่ตรงกันทั้งสาย** — `schema.sql`/`seed.sql` ใช้ `sdms`, `.env.example`/`db.js` default เป็น `smart_dormitory`, README บอกให้สร้าง `smart_dormitory` เอง.
   **Fix:** เลือกชื่อเดียวให้ตรงกันทุกไฟล์ พิจารณาตัด `CREATE DATABASE`/`USE` ออกจาก schema.sql

### High

4. **`database/seed.sql:25-30`** — รหัสผ่านแอดมินเริ่มต้น (`admin`/`ChangeMe@2026`) commit ไว้ในโค้ด ไม่มีกลไกบังคับเปลี่ยน.
   **Fix:** เพิ่มคอลัมน์ `password_must_change` บังคับเปลี่ยนก่อนใช้งาน

5. **`bill.model.js:101-104`, `cron.service.js:56-137`** — cron ตรวจบิลเกินกำหนด/แจ้งเตือน สแกนเต็มตาราง `bills` ทุกคืน ไม่มี index บน `status`/`due_date`.
   **Fix:** `ALTER TABLE bills ADD KEY idx_bills_status_due (status, due_date);`

6. **`cron.service.js:145-157`** — cron หมดอายุสัญญา สแกนเต็มตาราง `contracts` ไม่มี index บน `status`/`end_date`.
   **Fix:** `ALTER TABLE contracts ADD KEY idx_contracts_status_enddate (status, end_date);`

7. **`telegram.js:135`, `cron.service.js:37`** — `users.telegram_chat_id` ไม่มี index ทั้งที่ query ทุก cron/คำสั่งบอท.
   **Fix:** `ALTER TABLE users ADD KEY idx_users_telegram_chat_id (telegram_chat_id);`

### Medium

8. `schema.sql:305-325` — `maintenance_requests.assigned_to` เป็น `varchar` อิสระ ไม่มี FK จริงทั้งที่ตั้งชื่อ index เหมือนมี → เปลี่ยนเป็น `assigned_to_user_id int unsigned` + FK จริง
9. `schema.sql:388-398` — `password_resets` ไม่มี `NOT NULL`/`UNIQUE` → เพิ่ม constraint
10. `schema.sql:207,266` — `bill_month`/`reading_month` ไม่บังคับช่วง 1-12 → เพิ่ม `CHECK` constraint
11. `schema.sql:350-364`, `cron.service.js:74-83` — `notifications_log` ไม่มี index รองรับ query กันแจ้งซ้ำ + ใช้ `DATE()` ทำให้ non-sargable → เพิ่ม composite index และเปลี่ยนเงื่อนไขวันที่
12. `move_out_requests.tenant_id` ใช้ `ON DELETE CASCADE` ต่างจากตารางอื่นที่ใช้ `RESTRICT` → ทำให้สอดคล้องกัน
13. เอกสาร deploy ขัดแย้งกันเอง (CRON_SETUP.md/ARCHITECTURE.md พูดถึง PM2/VPS, DEPLOYMENT.md บอกเปลี่ยนไป Railway+Vercel แล้ว) → อัปเดตให้ตรงกัน
14. `docs/DEPLOYMENT.md:90-100` — checklist ไม่มีขั้นตอนรัน `seed.sql` (ไม่มีทางสร้างบัญชีแอดมินทางอื่น) → เพิ่มขั้นตอน

### Low

15. ไม่มี CI/CD, ไม่มี Dockerfile, ไม่มี test script ทั้งสอง package.json
16. ไม่มีระบบ migration — `schema.sql` เป็นไฟล์เดียวไม่มีเวอร์ชัน รันซ้ำกับฐานที่มีข้อมูลจะทำลายข้อมูล
17. `seed.sql:42-50` — ข้อมูล seed ดูสมจริงเกินไป (เลขภาษี/เบอร์โทร/ที่อยู่) ควรเปลี่ยนเป็นค่าปลอมชัดเจน
18. `oauth.routes.js:129-139` — สมัครผ่าน OAuth ปลอมเลขบัตร/เบอร์โทรใส่ฐานข้อมูล ไม่มี flag แยก
19. `DATABASE.md:113` — collation ไม่ตรงกันระหว่าง `schema.sql` กับฐานข้อมูลจริง (มีคน ALTER โดยไม่อัปเดต schema.sql)
20. ไม่มีการตรวจ env var ที่จำเป็นตอน startup (เช่น `JWT_SECRET` หายจะไม่ error จนกว่าจะมี login ครั้งแรก) + pool size hardcode

---

## 2. Backend — Express + MySQL (Critical 1 · High 3 · Medium 4 · Low 4)

### Critical

1. **`contract.controller.js:51-119` (`createContract`)** — Race condition: เช็คสถานะห้องว่างก่อนเปิด transaction ไม่มี `SELECT ... FOR UPDATE` และไม่มี DB constraint ป้องกัน → จองห้องเดียวซ้อน 2 สัญญาได้.
   **Fix:** ย้ายการอ่าน/ล็อกแถวห้องเข้าไปในทรานแซกชันด้วย `FOR UPDATE` เช็คซ้ำหลังล็อก

### High

2. **`contract.controller.js:162-210`, route `contract.routes.js:53`** — `terminateContract` เปิดให้ role `tenant` เรียกได้ ข้ามการอนุมัติของแอดมิน และไม่เรียก `DepositModel.finalizeRefund` เหมือน flow move-out ที่ถูกต้อง ไม่มี transaction ครอบ.
   **Fix:** ตัด role `tenant` ออก บังคับให้ยกเลิกสัญญาผ่าน `/api/move-out` เท่านั้น

3. **`payment.controller.js:91-121`, `payment.model.js:81-89`** — verify/reject ไม่มี transaction, UPDATE ไม่มี `WHERE status='pending_verify'` guard.
   **Fix:** ครอบ transaction เดียว + guard บน UPDATE เช็ค `affectedRows`

4. **`upload.middleware.js:80-98`** — fallback lookup `cloudinary.api.resource()` ยิงทุกครั้งโดยไม่จำเป็น (เงื่อนไข `!req.file.secure_url` เป็นจริงเสมอเพราะ `multer-storage-cloudinary@4.0.0` ไม่เคยตั้งค่านี้) → เสี่ยงชน Admin API rate limit.
   **Fix:** เช็ค `req.file.path` แทน หรือตัด fallback ทิ้ง

### Medium

5. `cron.service.js:143-168` — cron หมดอายุสัญญาไม่ปล่อยห้องคืน (ไม่เรียก `RoomModel.updateStatus`)
6. `room.routes.js:16-35`, `settings.routes.js:15-93`, `announcement.routes.js:13-18` — validation ไม่ครบ (status enum, num_floors, target_floor/is_pinned/is_urgent ตอน create) → 500 ดิบแทน 400
7. `payment.controller.js:77`, `payment.routes.js:13-28` — แจ้งชำระเงินได้โดยไม่ต้องแนบสลิป
8. `auth.controller.js:279-315` — token รีเซ็ตรหัสผ่านไม่ถูก invalidate เมื่อขอใหม่ ไม่เช็ค `is_active` ตอนรีเซ็ต

### Low

9. `telegram.service.js` (หลายจุด) — ไม่ escape อักขระ Markdown ของผู้ใช้ → ข้อความแจ้งเตือนอาจส่งไม่สำเร็จเงียบๆ
10. `bill.controller.js:106-109`, `meter.controller.js:84-91` — error message ไม่ friendly เมื่อชนกันตอนสร้างซ้ำ (ข้อมูลปลอดภัยเพราะมี unique constraint จริง)
11. ไม่มี automated test เลยฝั่ง backend
12. `utils/logger.js:21-22` — path ของไฟล์ log เป็น relative path (`process.cwd()`)

---

## 3. Frontend — Next.js (High 2 · Medium 3 · Low 7)

### High

1. **`register/page.tsx:112-113`, `auth-context.tsx:172-185`, `auth.controller.js:85-151`** — สมัครสมาชิกสำเร็จแต่ไม่ set session ให้ ผู้ใช้ใหม่ทุกคนโดนเด้งกลับหน้า login.
   **Fix:** เรียก login flow ต่อทันทีหลังสมัครสำเร็จ หรือ redirect ไป login พร้อมข้อความแจ้ง

2. **`admin/settings/page.tsx:190-206`** — ตรวจรูปแบบ PromptPay ID หลังบันทึกลง DB ไปแล้ว.
   **Fix:** ย้ายการตรวจ regex ไปก่อนเรียก API

### Medium

3. `admin/settings/page.tsx:257-264` — บันทึกอัตราค่าน้ำ-ไฟสำเร็จ แต่เรียก `toast.error` แทน `toast.success`
4. หน้าตารางข้อมูลจำนวนมาก (tenants, bills, contracts, payments, payment-history, maintenance, meters) ไม่มี pagination เลย ทั้งที่มี component `pagination.tsx` อยู่แล้วแต่ไม่มีใครเรียกใช้
5. `auth/telegram/callback/page.tsx:39-83` — ไม่มี guard กัน effect ยิงซ้ำ (มีใน Google callback แต่ไม่มีใน Telegram) → login สำเร็จจริงฝั่ง server แต่หน้าจอขึ้น error

### Low

6. `admin/layout.tsx:20-24` — session หมดอายุฝั่งแอดมินไม่เก็บ path เดิม (tenant ทำถูกต้องแล้ว)
7. `admin-navbar.tsx:54-57`, `tenant-navbar.tsx:43-46` — logout เรียก navigate ซ้ำซ้อน
8. `lib/api/deposit.api.js` — โค้ดตายไม่มีใครเรียกใช้ (ถูกรวมเข้า move-out flow แล้ว)
9. `tenant/profile/page.tsx:51-55` vs `lib/api/telegram.api.js` — Telegram API client มีสองชุดไม่ตรงกัน
10. `report.api.js`, `payment.api.js`, `bill.api.js`, `contract.api.js` — error message จริงจาก backend หายตอนดาวน์โหลดไฟล์ล้มเหลว (responseType: blob)
11. `admin/profile/page.tsx:37-38` — ตัดชื่อที่มีมากกว่า 2 คำทิ้ง (tenant profile ทำถูกต้องแล้ว)
12. ไม่มี automated test เลยฝั่ง frontend

---

## ตรวจแล้วไม่พบปัญหา (เพื่อไม่ให้พลาดตกหล่น)

- อ่าน `req.file.path` หลังอัปโหลด Cloudinary ถูกต้องตามพฤติกรรมจริงของ `multer-storage-cloudinary@4.0.0`
- SQL injection, IDOR, การเช็คสิทธิ์เจ้าของข้อมูล ถูกปิดช่องไปแล้วเกือบทั้งหมด
- ไม่มี token ใน localStorage/sessionStorage — auth ใช้ httpOnly cookie ล้วน
- CSRF token ถูกแนบอัตโนมัติผ่าน axios interceptor ทุก request ที่แก้ข้อมูล
- ปุ่มลบ/ยกเลิกที่ทำลายข้อมูลมี confirm dialog ครบทุกจุดที่ตรวจ
- ไม่พบ TODO/FIXME หรือ console.log หลงเหลือในโค้ดที่ใช้งานจริง

---

*ตรวจโดยอ่านซอร์สโค้ดจริงทั้งหมด — backend (controllers/middlewares/models/routes/services/utils ครบ 100%), frontend (ทุก route ภายใต้ admin/tenant, API client layer, auth context), และ database schema/seed/config/เอกสาร deploy*
