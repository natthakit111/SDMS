# 🏢 Smart Dormitory Management System

**ระบบบริหารจัดการหอพักและแจ้งเตือนอัตโนมัติ (Smart Dormitory Management System with Automated Notification)**

โครงงานนี้ถูกพัฒนาขึ้นเพื่อยกระดับการบริหารจัดการหอพักด้วยเทคโนโลยีสารสนเทศ โดยเปลี่ยนจากการจดบันทึกด้วยมือมาเป็นระบบดิจิทัลแบบเชิงรุก (Active System) ที่ครอบคลุมการจัดการวัฏจักรผู้เช่า การออกบิลด้วย Dynamic QR Code และการแจ้งเตือนผ่าน Telegram Bot อัตโนมัติ

---

## ✨ Features (คุณสมบัติเด่นของระบบ)

ระบบแบ่งการทำงานออกเป็น 2 ส่วนหลัก ตามบทบาทของผู้ใช้งาน:

### 👨‍💼 สำหรับผู้ดูแลหอพัก (Admin)
- **Dashboard & Management:** จัดการข้อมูลห้องพัก ผู้เช่า และสัญญาเช่า (Check-in/Check-out) ได้อย่างเป็นระบบ
- **Meter & Billing:** ระบบจดมิเตอร์น้ำ-ไฟฟ้าพร้อมฟังก์ชันแนบรูปถ่ายหลักฐาน และออกใบแจ้งหนี้อัตโนมัติ
- **Dynamic QR Code:** สร้าง QR Code มาตรฐาน PromptPay แบบระบุยอดเงินอัตโนมัติ เพื่อป้องกันการโอนเงินผิดพลาด
- **Maintenance & Broadcast:** จัดการคำร้องแจ้งซ่อม และระบบกระจายข่าวสาร (Broadcast) แจ้งเตือนไปยังผู้เช่าเฉพาะชั้นหรือทั้งหมดได้
- **Reporting:** ส่งออกรายงานข้อมูลสรุปในรูปแบบไฟล์ PDF และ Excel

### 🧑‍💻 สำหรับผู้เช่า (Tenant)
- **Billing & Payment:** ตรวจสอบใบแจ้งหนี้ สแกนจ่ายผ่าน Dynamic QR Code และอัปโหลดสลิปหลักฐาน
- **Payment History:** ตรวจสอบประวัติการชำระเงินย้อนหลังได้อย่างโปร่งใส
- **Maintenance Request:** ส่งคำร้องแจ้งซ่อมพร้อมแนบรูปถ่ายปัญหา และติดตามสถานะแบบเรียลไทม์
- **Telegram Integration:** ผูกบัญชีกับ Telegram Bot เพื่อรับการแจ้งเตือนบิลใหม่ ข่าวสาร และสถานะต่างๆ อัตโนมัติ

---

## 🛠️ Tech Stack & Architecture

ระบบถูกออกแบบภายใต้สถาปัตยกรรมแบบ **3-Tier Architecture** และ **RESTful API** พร้อมแนวคิดการจัดระเบียบโค้ดแบบ MVC (Model-View-Controller)

- **Frontend (Presentation Layer):** React.js (Next.js Framework) (Component-based architecture)
- **Backend (Logic Layer):** Node.js / Express.js (Event-Driven, Non-blocking I/O)
- **Database (Data Layer):** MySQL (Relational Database)
- **Auth:** JWT เก็บใน httpOnly cookie + double-submit CSRF token, รองรับ Google OAuth และ Telegram Login Widget
- **Integrations:**
  - [Telegram Bot API](https://core.telegram.org/bots/api) — แจ้งเตือนอัตโนมัติ + ผูกบัญชีผ่าน deep link
  - `promptpay-qr` — แปลงยอดชำระเป็น Payload สร้าง QR Code แบบ dynamic (ระบุยอดอัตโนมัติ)
  - `pdfkit` / `puppeteer` — สร้างใบแจ้งหนี้/ใบเสร็จเป็น PDF
  - `exceljs` — export รายงานเป็น Excel
  - `cloudinary` — เก็บไฟล์รูปภาพ/เอกสารที่อัปโหลด (สลิป, รูปมิเตอร์, ไฟล์สัญญา)

📄 ดูรายละเอียด endpoint ทั้งหมดได้ที่ [`backend/docs/API.md`](backend/docs/API.md)

---

## 🚀 Getting Started (วิธีการติดตั้งและรันโปรเจกต์)

### Prerequisites (สิ่งที่ต้องติดตั้งล่วงหน้า)
- [Node.js](https://nodejs.org/) (v16.x หรือใหม่กว่า)
- [pnpm](https://pnpm.io/) (สำหรับจัดการ Package ฝั่ง Frontend: ติดตั้งผ่านคำสั่ง `npm install -g pnpm`)
- [MySQL](https://www.mysql.com/) Server
- Git

### Installation (การติดตั้ง)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/natthakit111/SDMS.git
   cd SDMS
   ```

2. **Setup Database (MySQL):**
   - สร้าง Database ใหม่ใน MySQL (ค่า default ที่โค้ดคาดไว้คือ `smart_dormitory` — ดู `.env.example`)
   - นำเข้าไฟล์โครงสร้างฐานข้อมูล (schema) เข้าไปใน database นั้น

   > ⚠️ **ยังไม่มีไฟล์ schema ใน repo นี้** โฟลเดอร์ `database/` (ที่ควรมี `schema.sql`) ยังไม่ถูก push ขึ้น GitHub — ถ้ามีไฟล์นี้อยู่ในเครื่อง ให้ commit เข้า repo ด้วย (เช็คว่าไม่ได้ติดอยู่ใน `.gitignore` โดยไม่ตั้งใจ) มิฉะนั้นคนอื่น clone ไปแล้วจะสร้างฐานข้อมูลไม่ได้เลย

3. **Install Dependencies:**

   สำหรับ Backend:
   ```bash
   cd backend
   npm install
   ```

   สำหรับ Frontend:
   ```bash
   cd frontend
   pnpm install
   ```

4. **Environment Variables (.env):**
   ก็อปไฟล์ตัวอย่างแล้วแก้ค่าตามจริง:

   ```bash
   cd backend
   cp .env.example .env
   ```

   ตัวแปรหลักที่ต้องตั้งเพื่อให้รันได้ (ดูค่าทั้งหมดพร้อมคำอธิบายใน `backend/.env.example`):

   | ตัวแปร | คำอธิบาย |
   |---|---|
   | `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | เชื่อมต่อ MySQL |
   | `JWT_SECRET` | key เซ็น JWT — ต้องเปลี่ยนเป็นค่าสุ่มยาวๆ ก่อนใช้จริง |
   | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | สำหรับ Telegram Bot + Login Widget |
   | `BOT_INTERNAL_SECRET` | secret ภายในระหว่าง backend กับ bot process |
   | `CLOUDINARY_*` | เก็บไฟล์รูป/เอกสารที่ผู้ใช้อัปโหลด |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | สำหรับปุ่ม "เข้าสู่ระบบด้วย Google" |
   | `GMAIL_USER`, `GMAIL_APP_PASSWORD` | ส่งอีเมลลืมรหัสผ่าน (ต้องใช้ App Password ของ Google ไม่ใช่รหัส Gmail จริง) |

   > ตัวแปรที่ไม่ได้ตั้งค่า ระบบจะไม่ error ทันทีแต่ฟีเจอร์ที่เกี่ยวข้องจะถูกปิดเงียบๆ (เช่น ไม่ตั้ง `TELEGRAM_BOT_TOKEN` → บอทจะไม่ทำงานแต่เว็บยังใช้ได้ปกติ)

5. **Run the Application:**

   เปิด Terminal หน้าต่างที่ 1 (รัน Backend API):
   ```bash
   cd backend
   npm run dev
   ```

   เปิด Terminal หน้าต่างที่ 2 (รัน Frontend):
   ```bash
   cd frontend
   pnpm dev
   ```

---

## 🔒 Security Measures

- **Authentication:** JWT เก็บใน **httpOnly cookie** (ไม่ใช่ localStorage) ป้องกัน token หลุดผ่าน XSS, รองรับ login ด้วย username/password, Google OAuth, และ Telegram Login Widget
- **CSRF Protection:** double-submit cookie pattern (`csrf_token` cookie + header `X-CSRF-Token`) จำเป็นเพราะ frontend/backend อยู่คนละโดเมนกันตอน production เลยต้องใช้ `SameSite=None`
- **Authorization:** Role-Based Access Control แยกสิทธิ์ Admin และ Tenant ในทุก endpoint
- **Data Protection:** เข้ารหัสรหัสผ่านด้วย bcrypt ก่อนบันทึกลงฐานข้อมูล
- **OAuth Token Handling:** ไม่ส่ง JWT เต็มผ่าน URL query string ตอน OAuth callback (ป้องกันหลุดผ่าน browser history/server log) ใช้ short-lived exchange code แทน
- **Audit Log:** การแก้ไขค่าตั้งค่าระบบ (Settings) ทุกครั้งถูกบันทึกไว้ใน `settings_audit_log` พร้อมค่าเก่า/ใหม่และผู้แก้ไข

---

## 👥 Authors

- [ นายเมย์คาร์ สุวรรณวิสุทธิ์] - Frontend Developer
- [ นายณัฐกิตติ์ ยั่งยืนปิยรัตน์ ] - Backend Developer
- [ นายปรเมษฐ สุริคำ] - Database & System Analyst

*(พัฒนาขึ้นเพื่อเป็นส่วนหนึ่งของวิชาโครงงานวิศวกรรมซอฟต์แวร์ มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา)*