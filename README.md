# 🏢 Smart Dormitory Management System (SDMS)

**ระบบบริหารจัดการหอพักและแจ้งเตือนอัตโนมัติ**

SDMS เป็นระบบจัดการหอพักแบบครบวงจร พัฒนาขึ้นเพื่อแทนที่การจดบันทึกด้วยมือ/สเปรดชีตที่เจ้าของหอพักส่วนใหญ่ยังใช้กันอยู่ ด้วยระบบดิจิทัลที่ครอบคลุมตั้งแต่การรับผู้เช่าเข้าอยู่ จดมิเตอร์น้ำ-ไฟ ออกบิลพร้อม QR Code สำหรับจ่ายเงินอัตโนมัติ ไปจนถึงการแจ้งเตือนผ่าน Telegram Bot โดยไม่ต้องมีใครมานั่งไล่โทรทวงบิลเอง

ระบบแบ่งผู้ใช้งานออกเป็น 2 บทบาท: **ผู้ดูแลหอพัก (Admin)** ที่จัดการข้อมูลทั้งหมด และ **ผู้เช่า (Tenant)** ที่เข้ามาดูบิล จ่ายเงิน แจ้งซ่อม ผ่านหน้าเว็บของตัวเอง

---

## 📑 สารบัญ

- [ฟีเจอร์ของระบบ](#-ฟีเจอร์ของระบบ)
- [เทคโนโลยีที่ใช้](#-เทคโนโลยีที่ใช้)
- [โครงสร้างโปรเจกต์](#-โครงสร้างโปรเจกต์)
- [สถาปัตยกรรมระบบ](#-สถาปัตยกรรมระบบ)
- [วิธีติดตั้งและรันโปรเจกต์](#-วิธีติดตั้งและรันโปรเจกต์)
- [บัญชีทดสอบ (Seed Data)](#-บัญชีทดสอบ-seed-data)
- [เอกสารเพิ่มเติม](#-เอกสารเพิ่มเติม)
- [ความปลอดภัยของระบบ](#-ความปลอดภัยของระบบ)
- [การ Deploy ขึ้น Production](#-การ-deploy-ขึ้น-production)
- [ผู้พัฒนา](#-ผู้พัฒนา)

---

## ✨ ฟีเจอร์ของระบบ

### 👨‍💼 สำหรับผู้ดูแลหอพัก (Admin)

| โมดูล | รายละเอียด |
|---|---|
| **Dashboard** | สรุปภาพรวมหอพัก: จำนวนห้อง/ผู้เช่า, ยอดค้างชำระ, บิลและงานซ่อมล่าสุด |
| **ห้องพัก** | CRUD ข้อมูลห้องพักทั้งหมด สถานะห้อง (ว่าง/มีผู้เช่า/ปิดปรับปรุง) |
| **ผู้เช่า** | CRUD ข้อมูลผู้เช่า ประวัติการเข้าอยู่ |
| **สัญญาเช่า** | สร้าง/ต่อ/ยกเลิกสัญญา แนบไฟล์สัญญา |
| **มิเตอร์น้ำ-ไฟ** | จดค่ามิเตอร์รายเดือน แนบรูปถ่ายหลักฐาน |
| **บิล** | ออกบิลอัตโนมัติจากค่ามิเตอร์ + ค่าเช่า พร้อมคำนวณค่าปรับล่าช้าให้เอง |
| **การชำระเงิน** | สร้าง QR PromptPay ระบุยอดอัตโนมัติ ตรวจสลิปที่ผู้เช่าอัปโหลด อนุมัติ/ปฏิเสธ |
| **แจ้งซ่อม** | รับคำร้อง จัดการสถานะงานซ่อม |
| **ประกาศ** | กระจายข่าวสารแบบเลือกกลุ่มเป้าหมาย (ทั้งหมด/เฉพาะชั้น) |
| **ย้ายออก + เงินประกัน** | รับคำร้องย้ายออก พรีวิวยอดเงินประกันที่ต้องคืน อนุมัติ/ปฏิเสธ |
| **ตั้งค่าระบบ** | ตั้งค่าหอพัก/อัตราค่าน้ำ-ไฟ/ข้อมูลธนาคาร — ทุกการแก้ไขถูกบันทึกลง audit log |
| **รายงาน** | Export ข้อมูลเป็น Excel/PDF (ผ่าน API endpoint, ยังไม่มีหน้า UI เรียกโดยตรง) |

### 🧑‍💻 สำหรับผู้เช่า (Tenant)

| โมดูล | รายละเอียด |
|---|---|
| **หน้าแรก** | สรุปห้องพัก ยอดค้างชำระ ทางลัดไปยังเมนูหลัก |
| **บิลของฉัน** | ดูรายละเอียดบิล แยกค่าเช่า/น้ำ/ไฟ |
| **ชำระเงิน** | สแกน QR PromptPay จ่ายตรง หรืออัปโหลดสลิปโอนเงิน |
| **ประวัติการชำระเงิน** | ดูย้อนหลังทุกรายการที่เคยจ่าย พร้อมสถานะตรวจสอบ |
| **สัญญาเช่าของฉัน** | ดูรายละเอียดสัญญา วันเริ่ม/สิ้นสุด |
| **แจ้งซ่อม** | ส่งคำร้องพร้อมแนบรูป ติดตามสถานะได้แบบเรียลไทม์ |
| **ย้ายออก** | ยื่นคำร้องขอย้ายออก ดูพรีวิวเงินประกันที่จะได้คืน |
| **โปรไฟล์ & Telegram** | แก้ไขข้อมูลส่วนตัว ผูกบัญชี Telegram เพื่อรับแจ้งเตือน |
| **การแจ้งเตือน** | รวมแจ้งเตือนทั้งหมดในระบบ (บิลใหม่, ประกาศ, สถานะซ่อม) |

ดูสถานะความสมบูรณ์ของแต่ละโมดูลแบบละเอียด (route จริง + backend รองรับหรือยัง) ได้ที่ [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md)

---

## 🛠️ เทคโนโลยีที่ใช้

ระบบออกแบบเป็น **3-Tier Architecture** (Frontend / Backend API / Database) แยกกันชัดเจน สื่อสารกันผ่าน RESTful API เท่านั้น ฝั่ง backend จัดโครงสร้างโค้ดแบบ MVC (routes → controllers → models)

| Layer | เทคโนโลยี | หน้าที่ |
|---|---|---|
| **Frontend** | Next.js 16 (App Router) + React 19 + TypeScript | หน้าเว็บฝั่งผู้ใช้ ทั้ง Admin และ Tenant |
| | Tailwind CSS v4 + shadcn/ui | ระบบ design token + UI component |
| | `axios` | เรียก REST API ไปยัง backend |
| | `next-themes` | สลับ Light/Dark mode |
| | `qrcode.react` | แสดง QR Code ฝั่ง client (เช่น Telegram link) |
| **Backend** | Node.js + Express.js | REST API server |
| | `mysql2` | เชื่อมต่อฐานข้อมูล MySQL |
| | `jsonwebtoken` + `bcrypt` | ออก JWT และเข้ารหัสรหัสผ่าน |
| | `passport` + `passport-google-oauth20` | Google OAuth login |
| | `node-telegram-bot-api` | บอทแจ้งเตือน + ผูกบัญชีผ่าน deep link |
| | `node-cron` | รันงานตามเวลา (ปิดบิลเกินกำหนด, แจ้งเตือนอัตโนมัติ) |
| | `promptpay-qr` + `qrcode` | สร้าง QR PromptPay แบบระบุยอดเงินอัตโนมัติ |
| | `pdfkit` / `puppeteer` | สร้างใบแจ้งหนี้/ใบเสร็จเป็น PDF |
| | `exceljs` | Export รายงานเป็น Excel |
| | `cloudinary` + `multer` | อัปโหลด/เก็บไฟล์รูปภาพ (สลิป, รูปมิเตอร์, ไฟล์สัญญา) |
| | `nodemailer` | ส่งอีเมลลืมรหัสผ่าน |
| | `helmet`, `express-rate-limit`, `cors` | มาตรการความปลอดภัยพื้นฐานของ API |
| **Database** | MySQL | เก็บข้อมูลทั้งหมดแบบ Relational (ดูโครงสร้างตารางที่ [`backend/database/DATABASE.md`](backend/database/DATABASE.md)) |

---

## 📁 โครงสร้างโปรเจกต์

```
SDMS/
├── frontend/                  # Next.js App Router
│   ├── app/
│   │   ├── admin/             # หน้าฝั่งผู้ดูแล (13 โมดูล)
│   │   ├── tenant/            # หน้าฝั่งผู้เช่า (8 โมดูล)
│   │   ├── auth/              # callback สำหรับ Google/Telegram OAuth
│   │   ├── login/, register/, forgot-password/, reset-password/
│   │   └── globals.css        # design token ของทั้งระบบ (สี, radius, ธีม light/dark)
│   ├── components/
│   │   ├── ui/                # shadcn/ui primitives (button, card, dialog, ...)
│   │   ├── common/             # component ที่ reuse ข้ามหน้า (status-badge, stats-card, ...)
│   │   └── layout/             # sidebar, navbar, bottom-nav ของ admin/tenant
│   ├── context/                # React Context: auth, language, notification
│   └── lib/api/                # ฟังก์ชันเรียก backend แยกไฟล์ตาม resource
│
├── backend/                    # Express REST API
│   ├── app.js                  # ตั้งค่า Express app (middleware, routes)
│   ├── server.js                # entry point จริง — เริ่ม server + cron + telegram bot
│   ├── src/
│   │   ├── routes/              # ผูก URL เข้ากับ controller (1 ไฟล์ต่อ resource)
│   │   ├── controllers/         # รับ request → เรียก model/service → ตอบกลับ
│   │   ├── models/              # query ฐานข้อมูลตรงๆ (ไม่มี ORM)
│   │   ├── services/            # logic ที่ซับซ้อน/ใช้ร่วมกัน (บิล, PDF, cron, telegram, email)
│   │   ├── middlewares/         # auth guard, CSRF, upload, error handler
│   │   └── utils/                # helper ทั่วไป
│   ├── database/                # อยู่ใน backend/ เพราะ Railway deploy แค่โฟลเดอร์นี้ (Root Directory: backend)
│   │   ├── schema.sql           # โครงสร้างตารางทั้งหมด (รันก่อน)
│   │   ├── seed.sql             # ข้อมูลตั้งต้น (บัญชี admin, ห้องพักตัวอย่าง)
│   │   ├── migrations/          # migration ไล่ตามโครงสร้างล่าสุดของ schema.sql
│   │   └── DATABASE.md          # คำอธิบายตาราง + ERD
│   └── docs/API.md              # เอกสาร endpoint ทั้งหมด
│
└── docs/                        # เอกสารระดับโปรเจกต์ (สถาปัตยกรรม, deploy, cron, สถานะ)
```

---

## 🏗️ สถาปัตยกรรมระบบ

- Frontend และ Backend แยกโปรเจกต์กันเด็ดขาด สื่อสารผ่าน REST API เท่านั้น (ไม่มี server-side rendering ที่ยิง DB ตรง)
- Auth ใช้ JWT เก็บใน **httpOnly cookie** ป้องกันการขโมย token ผ่าน XSS พร้อม CSRF token คู่กัน (double-submit cookie pattern)
- งานที่ต้องรันตามเวลา (ปิดบิลเกินกำหนด, หมดอายุสัญญา, แจ้งเตือนบิล) รันอยู่ใน process เดียวกับ backend ผ่าน `node-cron` — ดูรายการ job และเวลาทั้งหมดที่ [`docs/CRON_SETUP.md`](docs/CRON_SETUP.md)
- Diagram แบบเต็ม (flow การออกบิลจนถึงจ่ายเงิน, flow สัญญา/ย้ายออก, flow telegram) อยู่ที่ [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — เขียนด้วย Mermaid, เปิดดูบน GitHub จะ render ให้อัตโนมัติ

---

## 🚀 วิธีติดตั้งและรันโปรเจกต์

### สิ่งที่ต้องมีก่อน

- [Node.js](https://nodejs.org/) v16 ขึ้นไป
- [pnpm](https://pnpm.io/) สำหรับฝั่ง frontend (`npm install -g pnpm`)
- [MySQL](https://www.mysql.com/) Server
- Git

### 1. Clone โปรเจกต์

```bash
git clone https://github.com/natthakit111/SDMS.git
cd SDMS
```

### 2. ตั้งค่าฐานข้อมูล (MySQL)

สร้างฐานข้อมูลเปล่าชื่อ `sdms` (หรือชื่ออื่นตามที่จะตั้งใน `.env` — ไฟล์ schema/seed ไม่ได้ล็อกชื่อไว้) แล้วรันไฟล์ schema ตามลำดับ:

```bash
mysql -u root -p -e "CREATE DATABASE sdms"
mysql -u root -p sdms < backend/database/schema.sql
mysql -u root -p sdms < backend/database/seed.sql   # ไม่บังคับ แต่แนะนำ — ได้บัญชี admin + ห้องตัวอย่างไว้ทดสอบทันที
```

รายละเอียดแต่ละตารางดูได้ที่ [`backend/database/DATABASE.md`](backend/database/DATABASE.md)

### 3. ติดตั้ง Dependencies

```bash
# Backend
cd backend
npm install

# Frontend (terminal ใหม่ หรือ cd กลับไปที่ root ก่อน)
cd ../frontend
pnpm install
```

### 4. ตั้งค่า Environment Variables

```bash
cd backend
cp .env.example .env
```

จากนั้นแก้ค่าใน `.env` ตามจริง — ตัวแปรหลักที่ต้องตั้งเพื่อให้รันได้:

| ตัวแปร | คำอธิบาย |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | เชื่อมต่อ MySQL ที่ตั้งไว้ในขั้นตอนที่ 2 |
| `JWT_SECRET` | key เซ็น JWT — **ต้องเปลี่ยนเป็นค่าสุ่มยาวๆ ก่อนใช้งานจริง** |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | สำหรับ Telegram Bot + Login Widget (ขอได้จาก [@BotFather](https://t.me/BotFather)) |
| `BOT_INTERNAL_SECRET` | secret ภายในระหว่าง backend กับ telegram bot process |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | เก็บไฟล์รูป/เอกสารที่ผู้ใช้อัปโหลด |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ปุ่ม "เข้าสู่ระบบด้วย Google" |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | ส่งอีเมลลืมรหัสผ่าน (ต้องใช้ [App Password](https://myaccount.google.com/apppasswords) ของ Google ไม่ใช่รหัส Gmail จริง) |

> ตัวแปรที่ไม่ได้ตั้งค่า ระบบจะไม่ error ทันที แต่ฟีเจอร์ที่เกี่ยวข้องจะถูกปิดเงียบๆ เท่านั้น (เช่น ไม่ตั้ง `TELEGRAM_BOT_TOKEN` → บอทไม่ทำงาน แต่เว็บส่วนอื่นยังใช้ได้ปกติ) ดูค่าทั้งหมดพร้อมคำอธิบายเต็มใน [`backend/.env.example`](backend/.env.example)

### 5. Migration (เฉพาะกรณีติดตั้งใหม่จาก schema.sql)

`backend/database/schema.sql` มีโครงสร้างล่าสุดอยู่แล้วเสมอ แต่ยังไม่มีการบันทึกว่า "รันโครงสร้างล่าสุดไปแล้ว" ไว้ในฐานข้อมูล — รันคำสั่งนี้ครั้งเดียวหลังติดตั้งจาก schema.sql สดๆ (ไม่ต้องรัน SQL ซ้ำ แค่บันทึกสถานะ):

```bash
cd backend
npm run migrate:baseline
```

ถ้าเป็นฐานข้อมูลเก่าที่ติดตั้งไว้ก่อนหน้านี้ (ไม่ได้เพิ่งรัน schema.sql สดๆ) ให้ใช้ `npm run migrate` แทน เพื่อไล่รันไฟล์ที่ยังไม่ได้ apply ในโฟลเดอร์ [`backend/database/migrations/`](backend/database/migrations) ให้ตามทันโครงสร้างล่าสุด — เช็คสถานะได้ด้วย `npm run migrate:status`

### 6. รันโปรเจกต์

เปิด 2 terminal พร้อมกัน:

```bash
# Terminal 1 — Backend (http://localhost:5000)
cd backend
npm run dev

# Terminal 2 — Frontend (http://localhost:3000)
cd frontend
pnpm dev
```

เปิดเบราว์เซอร์ไปที่ `http://localhost:3000`

---

## 🔑 บัญชีทดสอบ (Seed Data)

ถ้ารัน `backend/database/seed.sql` แล้ว จะมีบัญชี admin ตั้งต้นให้ทดสอบทันที:

| Username | Password | Role |
|---|---|---|
| `admin` | `ChangeMe@2026` | admin |

> ⚠️ นี่คือรหัสผ่านตัวอย่างสำหรับ development เท่านั้น **ต้อง login แล้วเปลี่ยนรหัสผ่านทันทีก่อน deploy ขึ้นใช้งานจริง**

---

## 📄 เอกสารเพิ่มเติม

| เอกสาร | เนื้อหา |
|---|---|
| [`backend/docs/API.md`](backend/docs/API.md) | endpoint ทั้งหมด, role ที่ต้องใช้, รูปแบบ request/response |
| [`backend/database/DATABASE.md`](backend/database/DATABASE.md) | โครงสร้างตาราง + ERD |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Flow diagram ของระบบ (ออกบิล, สัญญา/ย้ายออก, telegram) |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | ขั้นตอน deploy จริงขึ้น production |
| [`docs/CRON_SETUP.md`](docs/CRON_SETUP.md) | รายการ cron job ทั้งหมดและวิธีทดสอบ |
| [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) | สถานะความสมบูรณ์ของแต่ละโมดูล ณ ปัจจุบัน |

---

## 🔒 ความปลอดภัยของระบบ

- **Authentication:** JWT เก็บใน **httpOnly cookie** (ไม่ใช่ localStorage) ป้องกัน token หลุดผ่าน XSS รองรับ login ด้วย username/password, Google OAuth, และ Telegram Login Widget
- **CSRF Protection:** double-submit cookie pattern (`csrf_token` cookie + header `X-CSRF-Token`) — จำเป็นเพราะ frontend/backend อยู่คนละโดเมนกันตอน production จึงต้องใช้ `SameSite=None`
- **Authorization:** Role-Based Access Control แยกสิทธิ์ Admin/Tenant ในทุก endpoint
- **Data Protection:** เข้ารหัสรหัสผ่านด้วย bcrypt ก่อนบันทึกลงฐานข้อมูล ไม่เก็บ plaintext เด็ดขาด
- **OAuth Token Handling:** ไม่ส่ง JWT เต็มผ่าน URL query string ตอน OAuth callback (ป้องกันหลุดผ่าน browser history/server log) ใช้ short-lived exchange code แทน
- **Audit Log:** การแก้ไขค่าตั้งค่าระบบ (Settings) ทุกครั้งถูกบันทึกไว้ใน `settings_audit_log` พร้อมค่าเก่า/ใหม่และผู้แก้ไข

---

## 🌐 การ Deploy ขึ้น Production

โปรเจกต์ตั้งใจ deploy แบบ **Railway (Backend + MySQL) + Vercel (Frontend)** เพราะ backend มี cron job ที่ต้องรันอยู่ในตัว process ตลอดเวลา ซึ่ง Vercel (serverless) ทำไม่ได้ — ดูขั้นตอนเต็มพร้อมเหตุผลที่ [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

---

## 👥 ผู้พัฒนา

- นายเมย์คาร์ สุวรรณวิสุทธิ์ — Frontend Developer
- นายณัฐกิตติ์ ยั่งยืนปิยรัตน์ — Backend Developer
- นายปรเมษฐ สุริคำ — Database & System Analyst

*(พัฒนาขึ้นเพื่อเป็นส่วนหนึ่งของวิชาโครงงานวิศวกรรมซอฟต์แวร์ มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา)*
