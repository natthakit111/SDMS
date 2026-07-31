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
- **Integrations:**
  - [Telegram Bot API](https://core.telegram.org/bots/api) - สำหรับระบบแจ้งเตือนอัตโนมัติ
  - `promptpay-qr` - สำหรับแปลงยอดชำระเป็น Payload สร้าง QR Code

---

## 🚀 Getting Started (วิธีการติดตั้งและรันโปรเจกต์)

### Prerequisites (สิ่งที่ต้องติดตั้งล่วงหน้า)
- [Node.js](https://nodejs.org/) (v16.x หรือใหม่กว่า)
- [MySQL](https://www.mysql.com/) Server
- Git

### Installation (การติดตั้ง)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/SDMS.git
   cd SDMS
   ```

2. **Setup Database (MySQL):**
   - สร้าง Database ใหม่ใน MySQL (เช่น `SDMS_db`)
   - นำเข้าไฟล์โครงสร้างฐานข้อมูลจากโฟลเดอร์ `database/schema.sql` (ถ้ามี)

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
   สร้างไฟล์ `.env` ในโฟลเดอร์ `backend` และกำหนดค่าตัวแปรต่างๆ ดังนี้:

   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=your_password
   DB_NAME=SDMS_db
   JWT_SECRET=your_jwt_secret_key
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   PROMPTPAY_ID=your_promptpay_number
   ```

5. **Run the Application:**

   เปิด Terminal หน้าต่างที่ 1 (รัน Backend API):
   ```bash
   cd backend
   npm start
   ```

   เปิด Terminal หน้าต่างที่ 2 (รัน Frontend):
   ```bash
   cd frontend
   pnpm start
   ```

---

## 🔒 Security Measures

- **Authentication:** ใช้งาน JSON Web Token (JWT) ในการยืนยันตัวตนและจัดการ Session แบบ Stateless
- **Authorization:** มีระบบ Role-Based Access Control แยกสิทธิ์ Admin และ Tenant ชัดเจน
- **Data Protection:** เข้ารหัสผ่าน (Password Hashing) ก่อนบันทึกลงฐานข้อมูล

---

## 👥 Authors

- [ นายเมย์คาร์ สุวรรณวิสุทธิ์] - Frontend Developer
- [ นายณัฐกิตติ์ ยั่งยืนปิยรัตน์ ] - Backend Developer
- [ นายปรเมษฐ สุริคำ] - Database & System Analyst

*(พัฒนาขึ้นเพื่อเป็นส่วนหนึ่งของวิชาโครงงานวิศวกรรมซอฟต์แวร์ มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา)*
