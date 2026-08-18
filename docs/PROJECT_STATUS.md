# SDMS — Project Status

> **อัปเดต:** เอกสารเวอร์ชันก่อนหน้านี้ (ชื่อเดิม "DormFlow") อธิบายระบบตอนที่ frontend ยังใช้ mock data ล้วนๆ บน Next.js API routes ไม่มี backend จริง — ตอนนี้มี **backend จริงเป็น Express + MySQL** ทำงานสมบูรณ์แล้ว เอกสารนี้เขียนใหม่ให้ตรงกับสถานะปัจจุบัน

## สรุประบบ

Smart Dormitory Management System (SDMS) — ระบบจัดการหอพักครบวงจร แบ่งสิทธิ์ Admin/Tenant

- **Frontend:** Next.js (App Router)
- **Backend:** Express.js + MySQL — REST API แยกจาก frontend เต็มรูปแบบ
- **Auth:** JWT ใน httpOnly cookie + CSRF token, รองรับ login ปกติ, Google OAuth, Telegram Login Widget
- **File storage:** Cloudinary (ไม่ใช่ local/base64 mock แล้ว)
- **แจ้งเตือน:** Telegram Bot จริง ผ่าน cron job ในตัว backend (ดู [`CRON_SETUP.md`](./CRON_SETUP.md))

## Module ที่พร้อมใช้งานจริง (มี backend หนุนอยู่ ไม่ใช่ mock)

| Module | Admin route | Tenant route | Backend |
|---|---|---|---|
| Dashboard | `/admin` | `/tenant` | ✅ |
| ห้องพัก | `/admin/rooms` | — | ✅ CRUD เต็ม |
| ผู้เช่า | `/admin/tenants` | `/tenant/profile` | ✅ CRUD เต็ม |
| สัญญาเช่า | `/admin/contracts` | `/tenant/contract` | ✅ สร้าง/ต่อ/ยกเลิก/อัปโหลดไฟล์ |
| มิเตอร์น้ำ-ไฟ | `/admin/meters` | — | ✅ แนบรูปหลักฐาน |
| บิล | `/admin/bills` | `/tenant/bills` | ✅ generate อัตโนมัติจากมิเตอร์ + คำนวณค่าปรับ |
| การชำระเงิน | `/admin/payments` | `/tenant/payment` | ✅ QR PromptPay + อัปโหลดสลิป + verify/reject |
| ประวัติชำระเงิน | — | `/tenant/payment-history` | ✅ |
| แจ้งซ่อม | `/admin/maintenance` | `/tenant/maintenance` | ✅ แนบรูป, ติดตามสถานะ |
| ประกาศ | `/admin/announcements` | `/tenant/announcements` | ✅ กรองตามชั้น/กลุ่มเป้าหมาย |
| ย้ายออก + เงินประกัน | `/admin/move-out` | `/tenant/move-out` | ✅ พรีวิวเงินคืน, อนุมัติ/ปฏิเสธ |
| ตั้งค่าระบบ | `/admin/settings` | — | ✅ พร้อม audit log ทุกครั้งที่แก้ |
| การแจ้งเตือน | — | `/tenant/notifications` | ✅ |
| Telegram integration | (ผูกผ่านหน้า profile) | ✅ | ✅ ผูกบัญชีจริง + broadcast |
| Reports | (เฉพาะ backend endpoint, ยังไม่มีหน้า UI) | — | ✅ `/api/reports/*` — export Excel/PDF |

> ดู endpoint ทั้งหมดที่ [`backend/docs/API.md`](../backend/docs/API.md)

## สิ่งที่เปลี่ยนไปจากแผนเดิม (เอกสารเก่าพูดถึงแต่ไม่มีในระบบปัจจุบัน)

- **`/admin/deposits`** และ **`/admin/payment-verification`** เป็น route แยกในแผนเดิม — ปัจจุบันรวมเข้าไปใน flow ของ `move-out` (เงินประกัน) และ `payments` (ตรวจสลิป) แทน ไม่มีหน้าแยกอีกต่อไป
- **Excel Export** ที่เอกสารเก่าระบุว่า "ยังไม่ได้ทำ" — ตอนนี้ทำแล้วที่ backend (`exceljs`, ดู `/api/reports/*` และ `/api/reports/system-export`) แต่ฝั่ง frontend ยังไม่มีหน้า UI เรียกใช้โดยตรง (เรียกผ่าน URL/ลิงก์ดาวน์โหลดได้อยู่)

## ยังไม่มี / ควรทำต่อ

| รายการ | สถานะ |
|---|---|
| CI/CD pipeline | ยังไม่มี |
| Docker / containerization | ยังไม่มี — ดูวิธี deploy แบบ manual ที่ [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) |
| Database schema ใน repo | เพิ่งเพิ่มเข้ามา — ดู [`database/DATABASE.md`](../database/DATABASE.md) และ `database/sdms.sql` |

## เอกสารที่เกี่ยวข้อง

- [`backend/docs/API.md`](../backend/docs/API.md) — API endpoints ทั้งหมด
- [`database/DATABASE.md`](../database/DATABASE.md) — โครงสร้างตาราง/ERD
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — system flow diagrams
- [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) — วิธี deploy
- [`CRON_SETUP.md`](./CRON_SETUP.md) — cron jobs ที่ทำงานอยู่จริง
