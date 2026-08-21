# SDMS Database Schema

อ้างอิงจาก `database/schema.sql` — ถ้าแก้ schema ต้องอัปเดตเอกสารนี้ด้วยเสมอ ไม่งั้นเอกสารจะไม่ตรงกับของจริง

> ทุกครั้งที่แก้ `schema.sql` (เพิ่มคอลัมน์/index/ตาราง) ให้เพิ่มไฟล์ migration คู่กันไว้ใน [`database/migrations/`](./migrations) เสมอ เพื่อให้ฐานข้อมูลที่ติดตั้งไปแล้วก่อนหน้านี้ตามทันได้ผ่าน `npm run migrate` (ดูรายละเอียดใน README หัวข้อ "Migration")

## ERD ภาพรวม

```
                                   ┌───────────────┐
                                   │     users     │
                                   │ (login/role)  │
                                   └───────┬───────┘
                                           │ 1:1
                        ┌──────────────────┼──────────────────┐
                        │                  │                  │
                 ┌──────▼──────┐   ┌───────▼────────┐  ┌──────▼───────────┐
                 │   tenants   │   │telegram_link_   │  │oauth_exchange_    │
                 │ (profile)   │   │tokens           │  │codes               │
                 └──────┬──────┘   └────────────────┘  └────────────────────┘
                        │ 1:N
                 ┌──────▼──────┐        ┌─────────────┐
                 │  contracts  │◄───────┤    rooms    │
                 │             │  N:1   │             │
                 └──┬───┬───┬──┘        └──────┬──────┘
           1:1       │   │   │ 1:N              │ 1:N
     ┌───────────────┘   │   └──────────┐       │
     │                   │              │       │
┌────▼─────┐      ┌──────▼──────┐ ┌─────▼───────▼──┐   ┌──────────────────┐
│ deposits │      │move_out_    │ │      bills      │   │ meter_readings   │
│          │◄─────┤requests     │ │                 │   │ (room+type+month)│
└──────────┘ 0:1   └─────────────┘ └────────┬────────┘   └──────────────────┘
                                             │ 1:N
                                      ┌──────▼───────┐
                                      │   payments   │
                                      └──────────────┘

  rooms 1:N maintenance_requests        users 1:N notifications_log
  users 1:N settings_audit_log          dorm_settings (key-value, ไม่มี FK)
  users 1:N utility_rates (created_by)  users 1:N password_resets
```

## ตาราง

### `users` — บัญชีผู้ใช้ทุกคน (ทั้ง admin และ tenant)
Login หลักของระบบ, เก็บ role และการตั้งค่าแจ้งเตือนรายคน

| Column | Type | หมายเหตุ |
|---|---|---|
| `user_id` | PK | |
| `username`, `password_hash` | unique / bcrypt | |
| `role` | enum(`admin`,`tenant`) | |
| `email`, `phone` | unique | phone unique — เบอร์ซ้ำสมัครไม่ได้ |
| `telegram_chat_id` | bigint, nullable | ตั้งค่าตอนผูกบัญชีผ่าน `telegram_link_tokens` |
| `oauth_provider` / `oauth_provider_id` | nullable | `google` \| `telegram` — indexed คู่กัน |
| `notify_bill`, `notify_overdue`, `notify_maintenance`, `notify_announcement` | tinyint(1) | toggle การแจ้งเตือนรายประเภท ผู้ใช้ปิดเองได้ (ยกเว้นประกาศฉุกเฉิน ดู `announcements.is_urgent`) |

### `tenants` — ข้อมูลโปรไฟล์ผู้เช่า (1:1 กับ `users` ที่ role=tenant)
`id_card_number`, `phone`, `email` ทั้งหมด unique — กันข้อมูลซ้ำระดับ DB ไม่ใช่แค่ฝั่ง backend validate

### `rooms` — ห้องพัก
`room_number` unique, `status` enum(`available`,`occupied`,`maintenance`) — **ไม่มี trigger อัตโนมัติ** สถานะห้องต้องอัปเดตเองจาก backend เมื่อสร้าง/ยกเลิกสัญญา

### `contracts` — สัญญาเช่า
- อ้าง `tenant_id` + `room_id`
- `status` enum(`active`,`expired`,`terminated`) — `expired` ถูกตั้งอัตโนมัติโดย cron job (`expireContractsJob`, ทุกวัน 01:00) เมื่อ `end_date < CURDATE()`
- `contract_file` เก็บ path ไฟล์ที่อัปโหลด (Cloudinary)

### `deposits` — เงินประกัน (1:1 กับ contract ผ่าน `uq_deposit_contract`)
เชื่อมกับ `move_out_requests` แบบ nullable (ตอนทำสัญญายังไม่มี, จะสร้าง/อัปเดตตอนอนุมัติย้ายออก) `status` enum(`holding`,`refunded`)

### `move_out_requests` — คำร้องขอย้ายออก
มีทั้ง `move_out_date` (วันที่ tenant เสนอ) และ `actual_move_out_date` (วันที่แอดมินยืนยันจริงหลังตรวจห้อง) — **ใช้ `actual_move_out_date` ในการคำนวณค่าปรับ/เงินคืนประกันเท่านั้น** อย่าใช้ `move_out_date` เพราะเป็นแค่วันที่ tenant ขอ ไม่ใช่วันจริง

### `meter_readings` — ค่ามิเตอร์น้ำ/ไฟรายเดือน
- Unique key `(room_id, meter_type, reading_month, reading_year)` — จดซ้ำเดือนเดียวกันไม่ได้ ต้องแก้ของเดิม (`PUT`) แทน
- `units_used` เป็น **generated column** คำนวณจาก `current_unit - previous_unit` อัตโนมัติในระดับ DB

### `bills` — บิลค่าเช่า/น้ำ/ไฟ
- `active_key` เป็น generated column: `room_id-month-year` แต่เป็น `NULL` ถ้า `status='cancelled'` เพื่อให้ unique constraint (`uq_bill_room_month_active`) ยอมให้ generate บิลใหม่แทนบิลที่ถูกยกเลิกในเดือนเดียวกันได้
- `status` enum(`pending`,`paid`,`overdue`,`cancelled`) — เปลี่ยนเป็น `overdue` อัตโนมัติโดย cron (ทุกวัน 00:05)
- สูตรคำนวณ (`backend/src/services/bill.service.js`): `total = rent + (electric_units × electric_rate) + water_amount + other` — ค่าน้ำเลือกได้ 2 แบบผ่าน `dorm_settings.water_billing_type`: `unit` (คิดตามมิเตอร์) หรือ `flat` (เหมาจ่ายคงที่ ไม่ต้องมี meter reading)

### `payments` — การชำระเงิน
`status` enum(`pending_verify`,`verified`,`rejected`) — แอดมินต้องกด verify สลิปเอง ระบบไม่ mark บิลเป็น `paid` อัตโนมัติจนกว่าจะ verify ผ่าน

### `maintenance_requests` — แจ้งซ่อม
`status` enum(`pending`,`in_progress`,`resolved`,`cancelled`), `priority` enum(`low`,`medium`,`high`)

### `announcements` — ประกาศ
`target_audience` (`all`/`admin`/`tenant`) + `target_floor` (nullable, กรองเฉพาะชั้น) และ `is_urgent` — ประกาศฉุกเฉินจะส่งถึงผู้เช่าทุกคนแม้ปิด `notify_announcement` ไว้

### `utility_rates` — ประวัติอัตราค่าน้ำ/ไฟ
เก็บเป็น history (ไม่ใช่ overwrite) — บิลแต่ละใบอ้างอิงอัตรา ณ ตอนจดมิเตอร์ (เก็บ snapshot ไว้ใน `meter_readings.rate_per_unit` แล้ว ไม่ query ย้อนจากตารางนี้)

### `dorm_settings` — ค่าตั้งค่าระบบ แบบ key-value
ไม่มี FK เกี่ยวข้อง เก็บทุกอย่างตั้งแต่ชื่อหอ, PromptPay ID, ไปจนถึง `water_billing_type`

### `settings_audit_log` — ประวัติการแก้ `dorm_settings`
บันทึกทุกครั้งที่มีการ `PUT /api/settings` พร้อม `old_value`/`new_value`/ผู้แก้ไข

### ตารางระบบอื่นๆ
| ตาราง | หน้าที่ |
|---|---|
| `oauth_exchange_codes` | short-lived code (60 วิ) แลก JWT หลัง OAuth callback |
| `telegram_link_tokens` | token ชั่วคราวสำหรับผูกบัญชี Telegram (unique ต่อ user — ผูกใหม่ = token เก่าใช้ไม่ได้) |
| `password_resets` | token ลืมรหัสผ่าน |
| `notifications_log` | ประวัติการแจ้งเตือนที่ส่งออก (กันส่งซ้ำในวันเดียวกัน — cron เช็คตารางนี้ก่อนส่งทุกครั้ง) |

## จุดที่ต้องระวังเวลาแก้ schema

- **`bills.active_key`** เป็น generated column ที่ unique constraint พึ่งพาอยู่ — ถ้าจะเพิ่ม status ใหม่ต้องพิจารณาว่าควรกันซ้ำ (นับใน key) หรือไม่ด้วย ไม่งั้นจะ generate บิลซ้ำเดือนเดียวกันได้โดยไม่ error
- **`ON DELETE RESTRICT`** ถูกใช้เป็นหลักในความสัมพันธ์ที่มีผลทางการเงิน (bills, payments, contracts) ป้องกันการลบ room/tenant ที่มีประวัติธุรกรรมอยู่โดยไม่ตั้งใจ — ถ้าจะลบต้องจัดการ/ย้ายข้อมูลลูกก่อนเสมอ
- Collation ในไฟล์ dump มีปนกันระหว่าง `utf8mb4_unicode_ci` (ตารางเก่า) กับ `utf8mb4_0900_ai_ci` (ตารางที่เพิ่มทีหลัง เช่น oauth/telegram/password_resets) — ไม่กระทบการทำงานปกติ แต่ถ้า JOIN ข้าม collation กันตรงๆ ใน raw SQL (ไม่ผ่าน parameterized query) อาจต้อง cast