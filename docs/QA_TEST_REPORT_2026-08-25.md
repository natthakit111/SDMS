# SDMS — QA Test Report & Audit Follow-up (2026-08-25)

> บันทึกต่อเนื่องจาก [`AUDIT_REPORT_2026-08-20.md`](AUDIT_REPORT_2026-08-20.md) — ส่วนที่ 1 ไล่เช็คว่าปัญหา 44 จุดจากรอบนั้นแก้ไปถึงไหนแล้ว (อ้างอิง commit จริง + บางจุดยืนยันซ้ำด้วยการทดสอบจริงวันนี้) ส่วนที่ 2 เป็นผลทดสอบ regression ชุดใหม่ 50 เคสแรกจาก [`TEST_CASES.xlsx`](TEST_CASES.xlsx) (AUTH-01–MET-03) ทดสอบกับแอปที่รันจริง ไม่ใช่การอ่านโค้ดเฉยๆ

**สรุป:** จาก audit เดิม 44 จุด → แก้แล้วอย่างน้อย 34 จุด (มี commit อ้างอิงชัดเจน, 10 จุดในนั้นยืนยันซ้ำด้วยการทดสอบจริงวันนี้), เหลือไม่ยืนยัน/ยังไม่พบหลักฐานว่าแก้ 10 จุด (ส่วนใหญ่เป็น Low) · จากการทดสอบ 50 เคสใหม่วันนี้: **PASS 39 · FAIL 7 · BLOCKED 4** ตอนแรก (2 ใน 7 เป็นปัญหาที่เพิ่งเกิดจากการแก้ audit เดิมไม่สมบูรณ์ และ 1 ใน 7 คือ AUTH-09 ที่ผ่านตอนทดสอบบน local dev แต่ FAIL จริงบน production) — **ทั้ง 7 จุด FAIL ได้รับการแก้ไขและทดสอบยืนยันซ้ำแล้วครบทุกข้อภายในวันเดียวกัน** ดูรายละเอียดในส่วนที่ 3

> **⚠️ ข้อควรระวังเรื่อง scope การทดสอบ:** เคสส่วนใหญ่ในรายงานนี้ทดสอบกับ **local dev environment** เท่านั้น (backend :5000 / frontend :3000 รันในเครื่อง) มีเพียง AUTH-09 ที่ทดสอบซ้ำกับ production (`sdms-nt.vercel.app`) ตามที่ผู้ใช้แจ้งว่าเจอพฤติกรรมต่างจากรายงาน — ผลที่ต่างกันระหว่าง local กับ production เป็นไปได้เสมอโดยเฉพาะเรื่องที่เกี่ยวกับ infrastructure (rate limiting, scaling, environment variables ที่ตั้งค่าไม่เหมือนกัน) เคสอื่นที่ยังไม่ได้ทดสอบซ้ำบน production ควรถือว่า "ยืนยันบน local dev เท่านั้น" ไม่ใช่ "ยืนยันบนระบบจริงทั้งหมด"

---

## ส่วนที่ 1 — ติดตามผล Audit 2026-08-20

สัญลักษณ์สถานะ: **✅ ยืนยันด้วยการทดสอบจริงวันนี้** · **🔧 มี commit แก้ไขแล้ว (ยังไม่ได้ทดสอบซ้ำโดยตรง)** · **❓ ไม่พบหลักฐานว่าแก้**

### 1.1 ฐานข้อมูล & ความพร้อม Deploy

| # | ปัญหาเดิม | สถานะ | อ้างอิง |
|---|---|---|---|
| Crit-1 | ขึ้นบรรทัดใหม่แทรกในชื่อ DB | ✅ | `4ee368d` — ยืนยันวันนี้ว่า DB ชื่อ `sdms` ใช้งานได้ปกติ |
| Crit-2 | เอกสารอ้างไฟล์ `database/sdms.sql` ที่ไม่มีจริง | 🔧 | `c267a71` |
| Crit-3 | ชื่อ DB ไม่ตรงกันทั้งสาย (`sdms` vs `smart_dormitory`) | ✅ | `4ee368d` — ยืนยันวันนี้ |
| High-4 | รหัสผ่าน admin เริ่มต้นไม่บังคับเปลี่ยน | ⚠️ **แก้บางส่วน** | `9a03cf0` เพิ่ม `password_must_change` แล้ว แต่ทดสอบวันนี้ (AUTH-14) พบว่า**บล็อกแค่ฝั่ง frontend** — ยิง API ตรงด้วย session ที่ยังไม่เปลี่ยนรหัสผ่านใช้งานได้ปกติ ดูส่วนที่ 2 |
| High-5,6,7 | ไม่มี index บน bills/contracts/telegram_chat_id | ✅ | `0471d3b` — เพิ่ม index ครบ 3 ตัว |
| Med-8 | `maintenance_requests.assigned_to` ไม่ใช่ FK จริง | 🔧 | `189f070` |
| Med-9,10,11,12 | constraint หลายตารางไม่ครบ (password_resets, notifications_log, move_out_requests, bill/reading_month) | 🔧 | `db396ea` |
| Med-13 | เอกสาร deploy ขัดแย้งกัน | 🔧 | `830840c` |
| Med-14 | checklist deploy ไม่มีขั้นตอน seed.sql | 🔧 | `62ebb25` |
| Low-15 | ไม่มี CI/CD, Dockerfile | 🔧 | `8e2a922` |
| Low-16 | ไม่มีระบบ migration | 🔧 | `62ebb25` |
| Low-17 | seed data สมจริงเกินไป | 🔧 | `2d0dcea` |
| Low-18 | OAuth register ปลอมเลขบัตร/เบอร์ไม่มี flag แยก | ❓ | ไม่พบ commit ที่เกี่ยวข้อง |
| Low-19 | collation ไม่ตรงกัน schema vs DB จริง | ❓ | ไม่พบ commit ที่เกี่ยวข้อง |
| Low-20 | ไม่เช็ค env var ตอน startup + pool size hardcode | ✅ | `1f2c6ef` + `825e828` — ยืนยันวันนี้ (backend log แจ้งเตือน env ที่ขาดตอน start เห็นจริง เช่น GOOGLE/TELEGRAM ไม่ตั้งค่า) |

### 1.2 Backend

| # | ปัญหาเดิม | สถานะ | อ้างอิง |
|---|---|---|---|
| Crit-1 | Race condition จองห้องซ้อน 2 สัญญา | ✅ | `a69da34` — ทดสอบ CON-03 วันนี้ยิง 2 คำขอพร้อมกันจริง มีแค่ 1 สำเร็จ ยืนยันด้วย DB |
| High-2 | tenant ยกเลิกสัญญาตัวเองได้ ข้ามอนุมัติแอดมิน | ⚠️ **แก้แล้วแต่เอกสารไม่ตรง** | `fcd7b5e` — ทดสอบ CON-07 วันนี้ยืนยันว่า route บล็อก tenant จริง (403) แต่ `backend/docs/API.md` ยังเขียนว่า tenant ทำได้ ต้องอัปเดตเอกสารให้ตรง |
| High-3 | payment verify/reject ไม่มี transaction | 🔧 | เข้าใจว่าถูกแก้พร้อมกับ `a69da34` (commit ทดสอบ `4805dab` อ้างถึง "race condition + payment guard" คู่กัน) — ยังไม่ได้ทดสอบซ้ำโดยตรง (payment ไม่อยู่ในเคส 1–50) |
| High-4 | Cloudinary fallback lookup ไม่จำเป็น | 🔧 | `391151e` |
| Med-5 | cron หมดอายุสัญญาไม่ปล่อยห้องคืน | 🔧 | `21d59ea` — โค้ด/log ยืนยันว่า cron ตั้งเวลาไว้ถูกต้อง (01:00) แต่รอ trigger จริงไม่ได้ในช่วงทดสอบ (CON-06 = BLOCKED) |
| Med-6 | validation ไม่ครบ → 500 ดิบ | ✅ | `3dd3659` — ทดสอบ ROOM-07 วันนี้ยืนยันได้ 400 ไม่ใช่ 500 |
| Med-7 | แจ้งชำระเงินได้โดยไม่แนบสลิป | 🔧 | `ed81faf` |
| Med-8 | reset token ไม่ invalidate + ไม่เช็ค is_active | ✅ | `af4a163` — ทดสอบ AUTH-12/13 วันนี้ยืนยันครบ |
| Low-9 | Telegram markdown ไม่ escape | 🔧 | `391151e` |
| Low-10 | error message ไม่ friendly ตอนชนกันซ้ำ | ✅ | `11133b8`, `2a8ccd4` — ทดสอบ TEN-02/03/04 วันนี้ได้ error code ที่แปลไทยแล้ว (ยกเว้นจุดใหม่ที่พบเพิ่ม ดู TEN-05 ในส่วนที่ 2) |
| Low-11 | ไม่มี automated test เลย | 🔧 | `a4f62b9`, `4805dab` — มีไฟล์ทดสอบใน `backend/tests/` แล้ว 7 ไฟล์ |
| Low-12 | logger path เป็น relative | ❓ | ไม่พบ commit ที่เกี่ยวข้อง |

### 1.3 Frontend

| # | ปัญหาเดิม | สถานะ | อ้างอิง |
|---|---|---|---|
| High-1 | สมัครสมาชิกสำเร็จแต่ไม่ set session | ✅ | ทดสอบ AUTH-01 วันนี้ยืนยันว่า auto-login หลังสมัครทำงานถูกต้อง |
| High-2 | PromptPay ID ตรวจหลังบันทึกลง DB | 🔧 | `121841d` |
| Med-3 | toast.error แทน toast.success ตอนบันทึกอัตราค่าน้ำ-ไฟ | 🔧 | `72e61a9` |
| Med-4 | ไม่มี pagination หลายหน้า | ⚠️ **แก้บางส่วน** | `56f3376`, `9a99d2d`, `5ffcff4`, `63025b9` — ทดสอบ TEN-11 วันนี้ยืนยันว่า API รับ page/limit ได้ แต่ข้อมูลจริงในระบบยังไม่ถึง 20 รายการ ทดสอบ UI แบ่งหน้าจริงไม่ได้ |
| Med-5 | Telegram callback ไม่กัน effect ยิงซ้ำ | 🔧 | `6c351aa` |
| Low-6 | admin session หมดอายุไม่เก็บ path เดิม | ✅ | ทดสอบ AUTH-18 วันนี้ยืนยัน + อ่านโค้ด `axiosInstance.js`/`admin/layout.tsx` เห็น `redirect=` param ตรงกัน |
| Low-7 | logout navigate ซ้ำซ้อน | ❓ | ไม่พบ commit ที่เกี่ยวข้อง |
| Low-8 | `lib/api/deposit.api.js` โค้ดตาย | ❓ | ไม่พบ commit ที่เกี่ยวข้อง |
| Low-9 | Telegram API client สองชุดไม่ตรงกัน | ❓ | ไม่พบ commit ที่เกี่ยวข้อง |
| Low-10 | error message หายตอนดาวน์โหลดไฟล์ล้มเหลว (blob) | ❓ | ไม่พบ commit ที่เกี่ยวข้อง — **เกี่ยวข้องกับปัญหาใหม่ CON-09 ที่เจอวันนี้** ดูส่วนที่ 2 |
| Low-11 | ตัดชื่อที่มี >2 คำทิ้งฝั่ง admin profile | ❓ | ไม่พบ commit ที่เกี่ยวข้อง |
| Low-12 | ไม่มี automated test ฝั่ง frontend | ❓ | commit `a4f62b9` อ้างว่าเพิ่มทั้ง backend+frontend แต่พบไฟล์ทดสอบจริงแค่ใน `backend/tests/` — ยังไม่ยืนยันว่ามีฝั่ง frontend |

---

## ส่วนที่ 2 — ผลทดสอบ Regression ชุดใหม่ (2026-08-25, เคส 1–50)

ทดสอบ AUTH-01 ถึง MET-03 (18+7+12+10+3 = 50 เคส) กับแอปที่รันจริง (backend :5000 / frontend :3000 / MySQL `sdms`) 2 รอบ: รอบแรกโดย automated agent, รอบสองทวนสอบซ้ำทุกข้อด้วยตัวเอง (curl + query DB ตรง + browser จริง) เพื่อยืนยันความถูกต้อง — รายละเอียดฉบับเต็มพร้อมตารางทั้ง 50 แถวอยู่ใน web report ที่ publish ไว้ (ดูลิงก์ที่ผู้ใช้ได้รับในแชท)

**สรุป: PASS 39 · FAIL 7 · BLOCKED 4**

### ปัญหาที่พบ (FAIL) — เรียงตาม impact

| Test Case | ปัญหา | หมายเหตุ |
|---|---|---|
| **AUTH-09** | ผ่านบน local dev แต่ **FAIL จริงบน production** — ยิง login ผิด 17 ครั้งติดกันไปที่ `sdms-nt.vercel.app` ไม่โดนบล็อกเลย | Header `Ratelimit-Remaining` เด้งขึ้นลงไม่เป็นเส้นตรง (8→6→5→6→5→8) พิสูจน์ว่า backend รันหลาย instance พร้อมกัน (load balanced) และ `express-rate-limit` ใช้ `MemoryStore` default ที่แยก counter กันคนละ instance — ไม่มี instance ไหนสะสมครบ 10 ครั้ง ระบบป้องกัน brute-force ไม่ทำงานจริงตอนสำคัญที่สุด ต้องเปลี่ยนไปใช้ shared store (เช่น Redis) — **พบจากผู้ใช้ทดสอบเองบน production แล้วแจ้งว่าไม่เจอพฤติกรรมตามรายงาน** |
| **TEN-08** | ลบผู้เช่าที่มีสัญญา active สำเร็จโดยไม่ถูกปฏิเสธ — ห้อง/สัญญาค้างสถานะ occupied/active ทั้งที่ผู้เช่า login ไม่ได้แล้ว | `tenant.controller.js` ฟังก์ชัน `deleteTenant` ไม่เช็คสัญญา active เลย — **ปัญหาใหม่ ไม่เคยอยู่ใน audit เดิม** |
| **AUTH-14** | `password_must_change` บล็อกแค่ฝั่ง frontend ไม่ใช่ backend — ยิง API ตรงใช้งาน admin เต็มสิทธิ์ได้แม้ยังไม่เปลี่ยนรหัสผ่านตั้งต้น | เป็นการแก้ audit เดิม (High-4) แบบไม่สมบูรณ์ — ควรเพิ่ม middleware เช็คที่ backend ด้วย |
| **AUTH-11** | ขอ reset password → token สร้างสำเร็จใน DB แต่ API ตอบ 500 raw error จาก nodemailer เมื่อส่งอีเมลไม่สำเร็จ | `email.service.js` ไม่มี try/catch รอบ `sendResetPasswordEmail()` — **ปัญหาใหม่** |
| **CON-09** | อัปโหลดไฟล์สัญญาสำเร็จ แต่ดาวน์โหลดใช้ไม่ได้เลยแม้แต่เจ้าของไฟล์ — Cloudinary บล็อกไฟล์ raw/PDF แบบสาธารณะ (401) | อาจต้องแก้ที่ Cloudinary account setting หรือเปลี่ยนไปใช้ signed URL — **ปัญหาใหม่** เกี่ยวโยงกับ Frontend Low-10 เดิม (blob error message หาย) |
| **CON-07** | tenant ยกเลิกสัญญาตัวเองถูกบล็อก 403 — ตรงตามที่ audit เดิมแนะนำให้แก้ (`fcd7b5e`) แต่ `backend/docs/API.md` ยังไม่อัปเดตให้ตรง | ไม่ใช่บั๊ก เป็นเอกสารไม่ตรงกับพฤติกรรมจริง — ต้องตัดสินใจว่าจะแก้เอกสารหรือเปลี่ยน route |
| **AUTH-10** | tenant พิมพ์ URL `/admin` ตรงๆ ทั้งที่ session ยัง valid ถูกเด้งไป `/login` แทนที่จะเด้งกลับ `/tenant` | `admin/layout.tsx:32` เช็คแค่ `!user \|\| user.role !== "admin"` ไม่แยกกรณี "ไม่มี session" กับ "login ผิด role" — impact ต่ำ (ไม่ใช่ช่องโหว่ความปลอดภัย) |

### BLOCKED (ทดสอบ flow จริงไม่ได้ในสภาพแวดล้อมนี้ — ไม่ใช่ฟีเจอร์เสีย)

- **AUTH-15, AUTH-16** — ไม่ได้ตั้งค่า `GOOGLE_CLIENT_ID`/`TELEGRAM_BOT_TOKEN` ใน `.env` (ยืนยันจาก backend log ตอน start) route จัดการ error ได้เรียบร้อย (503 / โหลดหน้าได้) แต่ทดสอบ flow login จริงไม่ได้
- **TEN-11** — ข้อมูลผู้เช่าจริงในระบบไม่ถึง 20 คน ทดสอบ UI แบ่งหน้าจริงไม่ได้
- **CON-06** — cron auto-expire ตั้งเวลาไว้ 01:00 ทุกวันจริง (ยืนยันจาก log) แต่รอ trigger จริงในช่วงทดสอบไม่ได้

---

## ส่วนที่ 3 — สถานะการแก้ไข (อัปเดต 2026-08-25 ช่วงเย็น)

ทั้ง 7 จุด FAIL ถูกแก้และทดสอบยืนยันซ้ำแล้วทุกข้อ (commit `980e327` และ commit ถัดไป):

| Test Case | สถานะ | รายละเอียดการแก้ + ทดสอบ |
|---|---|---|
| **TEN-08** | ✅ แก้แล้ว | เพิ่มเช็ค `ContractModel.findActiveByTenant` ใน `deleteTenant` ก่อนลบ — ทดสอบยืนยัน: บล็อกตอนมีสัญญา active, ยังลบได้ปกติตอนไม่มี (ไม่มี regression) |
| **AUTH-14** | ✅ แก้แล้ว | เพิ่ม `UserModel.getAuthStatus` + เช็ค `password_must_change` ใน `authenticate` middleware บล็อกทุก endpoint ยกเว้น `/auth/change-password`, `/auth/logout`, `/auth/me` — ทดสอบยืนยัน: `GET /api/rooms` ตอบ 403 ระหว่างบังคับเปลี่ยนรหัส, เปลี่ยนรหัสผ่านสำเร็จแล้วใช้งานได้ปกติทันที |
| **AUTH-11** | ✅ แก้แล้ว | ครอบ try/catch รอบ `sendResetPasswordEmail` แยกจาก logic หลัก — ทดสอบยืนยัน: ตอบ 200 แม้ SMTP ไม่ถูกตั้งค่า และ error ถูก log ไว้ที่ `logs/error.log` ให้ debug ได้ |
| **CON-09** | ✅ แก้แล้ว (มีข้อจำกัด) | เปลี่ยนอัปโหลดไฟล์สัญญาเป็น `type: authenticated` + ดาวน์โหลดผ่าน `cloudinary.utils.private_download_url` แทน public delivery URL — ทดสอบยืนยัน: อัปโหลด→ดาวน์โหลดได้ไฟล์ตรงกับที่อัปโหลดจริง (200), cross-tenant ยังโดนบล็อก 403 เหมือนเดิม **⚠️ ข้อจำกัด:** ไฟล์สัญญาที่อัปโหลดไว้ก่อนแก้ (type เดิม = `upload`) ยังดาวน์โหลดไม่ได้ ต้องอัปโหลดใหม่ทับ |
| **CON-07** | ✅ แก้แล้ว | อัปเดต `backend/docs/API.md` ให้ตรงกับพฤติกรรมจริง (admin เท่านั้น) ไม่ต้องแก้โค้ด |
| **AUTH-10** | ✅ แก้แล้ว | `admin/layout.tsx` และ `tenant/layout.tsx` แยกกรณี "ไม่มี session" (→ `/login`) กับ "login ผิด role" (→ หน้าแรกของ role ตัวเอง) |
| **AUTH-09** | ✅ แก้แล้ว (ต้องตั้งค่าเพิ่มบน production) | เปลี่ยน rate limiter จาก `MemoryStore` เป็น `RedisStore` (ผ่าน `REDIS_URL`, fallback เป็น MemoryStore ถ้าไม่ตั้งค่า) — ทดสอบยืนยันด้วย Redis container จริง: รัน 2 instance พร้อมกัน สลับยิง request ระหว่าง instance แล้ว block ถูกต้องที่ request รวมครั้งที่ 11 (พิสูจน์ว่า counter share กันข้าม instance จริง ตรงข้ามกับพฤติกรรมเดิมที่แต่ละ instance นับแยกกัน) **⚠️ ต้องทำเพิ่มบน production:** provision Redis instance (เช่น Railway Redis plugin หรือ Upstash) แล้วตั้งค่า `REDIS_URL` ใน environment variables — โค้ดพร้อมแล้วแต่จะยังใช้ MemoryStore เดิมถ้าไม่ตั้งค่านี้ |

**สรุปคงเหลือ:**
1. 10 จุดที่เป็น ❓ ในส่วนที่ 1 (ส่วนใหญ่ Low) ยังไม่มีหลักฐานว่าแก้ — ควรตรวจสอบรอบถัดไปหรือปิดเป็น known-issue ถ้าตัดสินใจไม่แก้
2. เคส 51–101 ใน `TEST_CASES.xlsx` ยังไม่ได้ทดสอบ (บิล, การชำระเงิน, แจ้งซ่อม, ประกาศ, ย้ายออก+เงินประกัน, ตั้งค่าระบบ, รายงาน) — ควรทำ regression รอบถัดไปให้ครบ
3. **สำคัญ:** ต้อง provision Redis + ตั้งค่า `REDIS_URL` บน production ก่อน AUTH-09 จะแก้จริงในระบบที่ใช้งานอยู่ (โค้ดพร้อมแล้ว รอแค่ infrastructure)
