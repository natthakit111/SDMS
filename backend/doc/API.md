# SDMS API Documentation

เอกสารนี้อ้างอิงจากโค้ดจริงใน `backend/src/routes/` ณ วันที่จัดทำ — ถ้าแก้ route ต้องอัปเดตไฟล์นี้ตามไปด้วย

## Base URL & Response Format

```
Base URL: http://localhost:5000/api   (dev)
```

ทุก endpoint คืนค่าเป็น JSON ในรูปแบบเดียวกัน (`backend/src/utils/response.js`):

```json
// สำเร็จ
{ "success": true, "message": "...", "data": { } }

// ผิดพลาด
{ "success": false, "message": "...", "errors": [ ], "code": "..." }
```

| Status | ความหมาย |
|---|---|
| 200 | สำเร็จ |
| 201 | สร้างข้อมูลสำเร็จ |
| 400 | ข้อมูลที่ส่งมาไม่ถูกต้อง (validation) |
| 401 | ไม่ได้ login / token หมดอายุ / ไม่ถูกต้อง |
| 403 | login แล้วแต่ role ไม่มีสิทธิ์ |
| 404 | ไม่พบข้อมูล |
| 500 | server error |

## Authentication

ระบบใช้ **JWT เก็บใน httpOnly cookie** (ไม่ใช่ localStorage) เพื่อป้องกัน XSS ขโมย token:

- Cookie `token` — httpOnly, เก็บ JWT จริง, อายุ 1 วัน (หรือ 7 วันถ้า remember me)
- Cookie `auth_hint` — readable โดย JS, ใช้แค่เช็คว่ามี session อยู่ไหม (ไม่มีข้อมูลอ่อนไหว)
- Cookie `csrf_token` — readable โดย JS, ต้องแนบกลับมาใน header `X-CSRF-Token` ทุก request ที่แก้ข้อมูล (double-submit CSRF protection เพราะ frontend/backend คนละโดเมนกันตอน production เลยต้องใช้ `SameSite=None`)

Middleware ยังรองรับ `Authorization: Bearer <token>` เป็น fallback ชั่วคราวไว้ด้วย

**Role ที่มีในระบบ:** `admin`, `tenant` — คุมด้วย `authorizeRoles('admin' | 'tenant')` แยกจาก `authenticate` (ตรวจแค่ login) เสมอ

---

## Auth — `/api/auth`

| Method | Path | Auth | Role | คำอธิบาย |
|---|---|---|---|---|
| POST | `/auth/register` | Public | - | สมัครสมาชิกใหม่ (เฉพาะ tenant เท่านั้น, role ถูก hardcode ฝั่ง server กัน escalation) ต้องส่ง `phone`, `password` (≥6 ตัวอักษร) |
| POST | `/auth/login` | Public | - | เข้าสู่ระบบด้วย `username`, `password` — ตั้ง auth cookies ให้ |
| POST | `/auth/logout` | Public | - | ล้าง auth cookies |
| POST | `/auth/forgot-password` | Public | - | ขอลิงก์รีเซ็ตรหัสผ่าน (ส่งอีเมล) |
| POST | `/auth/reset-password` | Public | - | ตั้งรหัสผ่านใหม่ด้วย token จากอีเมล |
| GET | `/auth/me` | ✅ | any | ข้อมูล user ที่ login อยู่ |
| PUT | `/auth/profile` | ✅ | any | แก้ไขโปรไฟล์ (`firstName`, `lastName`, `email`, `phone`) |
| PUT | `/auth/change-password` | ✅ | any | เปลี่ยนรหัสผ่าน ต้องส่ง `currentPassword` + `newPassword` |
| POST | `/auth/set-password` | ✅ | any | สำหรับ user ที่สมัครผ่าน OAuth ตั้งรหัสผ่านครั้งแรก |

### OAuth — `/api/auth` (ใน `oauth.routes.js`)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/auth/google` | เริ่ม flow Google OAuth |
| GET | `/auth/google/callback` | Google redirect กลับมาที่นี่ → ออก exchange code → redirect ไป frontend พร้อม `?code=` |
| GET | `/auth/telegram` | หน้า Telegram Login Widget |
| GET | `/auth/telegram/callback` | Widget redirect มาที่นี่ → verify HMAC → ออก exchange code |
| POST | `/auth/oauth/exchange` | Public — frontend ส่ง `{ code }` ที่ได้จาก redirect มาแลกเป็น session จริง (ตั้ง cookie), คืน `{ user }` |

> **หมายเหตุความปลอดภัย:** OAuth ไม่ส่ง JWT เต็มผ่าน URL โดยตรง (เสี่ยงหลุดผ่าน browser history/log) แต่ใช้ short-lived exchange code (60 วินาที, ใช้ได้ครั้งเดียว) ให้ frontend เอาไปแลก JWT จริงทาง POST อีกที

---

## Rooms — `/api/rooms`

ทุก route ต้อง login (`authenticate` ครอบทั้งไฟล์)

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/rooms/stats` | any | สถิติภาพรวมห้องพัก |
| GET | `/rooms` | any | รายการห้องทั้งหมด |
| GET | `/rooms/:id` | any | รายละเอียดห้อง |
| POST | `/rooms` | admin | สร้างห้องใหม่ — ต้องส่ง `room_number`, `floor`, `room_type`, `base_rent` |
| PUT | `/rooms/:id` | admin | แก้ไขห้อง (partial update, ทุก field optional) |
| DELETE | `/rooms/:id` | admin | ลบห้อง |

---

## Tenants — `/api/tenants`

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/tenants/me/profile` | tenant | โปรไฟล์ของตัวเอง |
| PUT | `/tenants/me/profile` | tenant | แก้ไขโปรไฟล์ตัวเอง |
| GET | `/tenants/notification-preferences` | tenant | ดูการตั้งค่าแจ้งเตือนของตัวเอง |
| PUT | `/tenants/notification-preferences` | tenant | แก้ไขการตั้งค่าแจ้งเตือน |
| GET | `/tenants` | admin | รายชื่อผู้เช่าทั้งหมด (`?search=`) |
| GET | `/tenants/:id` | admin | รายละเอียดผู้เช่า |
| POST | `/tenants` | admin | เพิ่มผู้เช่าใหม่ — ต้องมี `password`, `first_name`, `last_name`, `id_card_number` (13 หลัก), `phone` (รูปแบบเบอร์ไทย) |
| PUT | `/tenants/:id` | admin | แก้ไขข้อมูลผู้เช่า |
| DELETE | `/tenants/:id` | admin | ลบผู้เช่า |

---

## Contracts — `/api/contracts`

ทุก route ต้อง login

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/contracts/my` (alias `/contracts/my/active`) | tenant | สัญญาของตัวเอง |
| GET | `/contracts` | admin | รายการสัญญาทั้งหมด |
| POST | `/contracts` | admin | สร้างสัญญาใหม่ — `tenant_id`, `room_id`, `start_date`, `end_date` |
| GET | `/contracts/:id` | any (เจ้าของหรือ admin) | รายละเอียดสัญญา |
| PUT | `/contracts/:id` | admin | แก้ไขสัญญา |
| PUT | `/contracts/:id/renew` | admin | ต่อสัญญา — ต้องส่ง `end_date` ใหม่ |
| PUT | `/contracts/:id/terminate` | admin, tenant | ยกเลิกสัญญา |
| POST | `/contracts/:id/upload` | admin | อัปโหลดไฟล์สัญญา (PDF/Word) |
| GET | `/contracts/:id/file` | any (สิทธิ์เช็คใน controller) | ดาวน์โหลดไฟล์สัญญา |

---

## Meters — `/api/meters`

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/meters` | admin | รายการค่ามิเตอร์ทั้งหมด |
| GET | `/meters/rooms/:roomId/previous` | admin | ค่ามิเตอร์ครั้งล่าสุดของห้อง (auto-fill ฟอร์ม) |
| GET | `/meters/available-rooms` | admin | ห้องที่ยังไม่ได้จดมิเตอร์เดือนนี้ |
| GET | `/meters/:id` | admin | รายละเอียดค่ามิเตอร์ |
| POST | `/meters` | admin | บันทึกค่ามิเตอร์ใหม่ (multipart, แนบรูปได้) — `room_id`, `meter_type` (`electric`/`water`), `reading_month`, `reading_year`, `current_unit` |
| PUT | `/meters/:id` | admin | แก้ไขค่ามิเตอร์ |

---

## Bills — `/api/bills`

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/bills/my` | tenant | บิลของตัวเอง |
| GET | `/bills/report/monthly` | admin | รายงานสรุปรายเดือน |
| POST | `/bills/generate` | admin | ออกบิลใหม่ — `room_id`, `month` (1-12), `year` |
| GET | `/bills` | admin | รายการบิลทั้งหมด |
| GET | `/bills/available-rooms` | admin | ห้องที่ยังไม่ได้ออกบิลเดือนนี้ |
| GET | `/bills/:id/qr` | any (login) | QR Code PromptPay สำหรับจ่ายบิลนี้ |
| GET | `/bills/:id/invoice-pdf` | any (login) | ดาวน์โหลดใบแจ้งหนี้เป็น PDF |
| GET | `/bills/:id` | any (login) | รายละเอียดบิล |
| PUT | `/bills/:id/cancel` | admin | ยกเลิกบิล |

---

## Payments — `/api/payments`

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/payments/my` | tenant | ประวัติการชำระเงินของตัวเอง |
| POST | `/payments` | tenant | แจ้งชำระเงิน (multipart, แนบสลิป) — `bill_id`, `payment_method` (`qr_promptpay`/`cash`/`bank_transfer`) |
| GET | `/payments` | admin | รายการชำระเงินทั้งหมด (รอตรวจสอบ/อนุมัติแล้ว) |
| GET | `/payments/:id` | any (login) | รายละเอียดการชำระเงิน |
| PUT | `/payments/:id/verify` | admin | อนุมัติสลิป |
| PUT | `/payments/:id/reject` | admin | ปฏิเสธสลิป |

---

## Utility Rates — `/api/utility-rates`

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/utility-rates/current` | any (login) | อัตราค่าน้ำ-ไฟปัจจุบัน |
| GET | `/utility-rates` | admin | ประวัติอัตราทั้งหมด |
| POST | `/utility-rates` | admin | ตั้งอัตราใหม่ — `utility_type` (`electric`/`water`), `rate_per_unit`, `effective_from` |

---

## Maintenance — `/api/maintenance`

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/maintenance/my` | tenant | คำร้องแจ้งซ่อมของตัวเอง |
| GET | `/maintenance/stats` | admin | สถิติคำร้อง |
| POST | `/maintenance` | tenant | แจ้งซ่อมใหม่ (multipart, แนบรูป) — `category`, `description` (≥10 ตัวอักษร), `priority` optional |
| GET | `/maintenance` | admin | รายการคำร้องทั้งหมด |
| GET | `/maintenance/:id` | any (login) | รายละเอียดคำร้อง |
| PUT | `/maintenance/:id/status` | admin | อัปเดตสถานะ — `pending`/`in_progress`/`resolved`/`cancelled` |
| PUT | `/maintenance/:id/cancel` | tenant | ยกเลิกคำร้องของตัวเอง |

---

## Announcements — `/api/announcements`

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/announcements` | any (login) | รายการประกาศ (กรองตาม floor ของ tenant อัตโนมัติ) |
| GET | `/announcements/:id` | any (login) | รายละเอียดประกาศ |
| POST | `/announcements` | admin | สร้างประกาศ — `title`, `content`, `target_audience` (`all`/`admin`/`tenant`) optional |
| PUT | `/announcements/:id` | admin | แก้ไขประกาศ (partial update) |
| DELETE | `/announcements/:id` | admin | ลบประกาศ |

---

## Move-out — `/api/move-out`

| Method | Path | Role | คำอธิบาย |
|---|---|---|---|
| GET | `/move-out` | any (login) | รายการคำร้องย้ายออก (admin เห็นทั้งหมด, tenant เห็นของตัวเอง) |
| POST | `/move-out` | tenant | แจ้งขอย้ายออก — `move_out_date`, `reason` |
| GET | `/move-out/:id/deposit-preview` | admin | พรีวิวยอดคืนเงินประกันก่อนอนุมัติ |
| PUT | `/move-out/:id/approve` | admin | อนุมัติการย้ายออก |
| PUT | `/move-out/:id/reject` | admin | ปฏิเสธคำร้อง |

---

## Telegram — `/api/telegram`

| Method | Path | Auth | คำอธิบาย |
|---|---|---|---|
| GET | `/telegram/status` | ✅ | เช็คว่าผูกบัญชี Telegram อยู่หรือไม่ |
| POST | `/telegram/generate-link` | ✅ | สร้าง deep link สำหรับผูกบัญชีกับ Telegram Bot (อายุ 10 นาที) |
| POST | `/telegram/link` | Internal secret เท่านั้น (header `X-Internal-Secret`) | เรียกโดย bot process หลัง user กด deep link ยืนยัน |
| DELETE | `/telegram/unlink` | ✅ | ยกเลิกการผูกบัญชี |
| POST | `/telegram/broadcast` | admin | ส่งข้อความ broadcast ไปหา tenant ที่ผูก Telegram ทุกคน |

---

## Reports — `/api/reports`  (admin only ทั้งหมด)

| Method | Path | Query | คำอธิบาย |
|---|---|---|---|
| GET | `/reports/revenue` | `year`, `format` (`excel`/`pdf`) | รายงานรายรับรายปี |
| GET | `/reports/rooms` | `format` | รายงานสถานะห้องพัก |
| GET | `/reports/payments` | `month`, `year`, `format` | รายงานการชำระเงิน |
| GET | `/reports/system-export` | - | Export ข้อมูลทั้งระบบเป็น Excel หลาย sheet |

---

## Settings — `/api/settings`  (admin only ทั้งหมด)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/settings` | ดูค่าตั้งค่าปัจจุบัน (ชื่อหอ, ที่อยู่, เลขผู้เสียภาษี, PromptPay, ธนาคาร, การแจ้งเตือน ฯลฯ) |
| PUT | `/settings` | แก้ไขค่าตั้งค่า (whitelist field, บันทึก audit log อัตโนมัติทุกครั้ง) |
| GET | `/settings/audit-log` | ประวัติการแก้ไขค่าตั้งค่า (`?setting_key=`, `?limit=`) |

---

## Route ordering — ข้อควรระวังเวลาแก้ไข

หลายไฟล์ route จงใจวาง **specific path ไว้ก่อน wildcard `/:id`** เสมอ (เช่น `/bills/my` ต้องมาก่อน `/bills/:id`) เพราะ Express จับ path ตามลำดับที่ประกาศ — ถ้าสลับที่กัน `/my` จะถูกตีความว่าเป็นค่า `:id` แทน ทำให้ endpoint นั้นพังทันที ถ้าเพิ่ม route ใหม่ในไฟล์ไหนที่มี wildcard อยู่แล้ว ให้แทรกไว้เหนือ wildcard เสมอ

## Validation pattern — ข้อควรระวังเวลาแก้ไข

`express-validator` chain object เป็น **mutable** — ห้ามสร้าง `updateValidation` ด้วยการ `.map(v => v.optional())` จาก `createValidation` เด็ดขาด เพราะจะไป mutate ตัวต้นทางที่ POST ใช้อยู่ด้วย (เคยเป็นบั๊กจริงในโปรเจกต์นี้มาแล้วหลายจุด) ให้สร้าง array ใหม่แยกต่างหากเสมอเวลาต้องการ partial-update validation