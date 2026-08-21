# SDMS Architecture & Flow Diagrams

Diagram ทั้งหมดเป็น [Mermaid](https://mermaid.js.org/) — GitHub render ให้อัตโนมัติเวลาเปิดไฟล์นี้บนเว็บ

## System Overview

```mermaid
flowchart LR
    subgraph Client["Vercel (Frontend)"]
        FE[Next.js Frontend]
    end
    subgraph Server["Railway (Backend)"]
        BE[Express Backend]
        CRON[node-cron\nin-process scheduler]
    end
    DB[(Railway MySQL)]
    CLOUD[Cloudinary\nfile storage]
    TG[Telegram Bot API]
    GOOGLE[Google OAuth]
    MAIL[Gmail SMTP]

    FE <-->|REST API + cookie auth| BE
    BE <--> DB
    BE -->|upload slip/รูปมิเตอร์/ไฟล์สัญญา| CLOUD
    BE <-->|ส่งแจ้งเตือน / login widget| TG
    BE <-->|OAuth login| GOOGLE
    BE -->|ลืมรหัสผ่าน| MAIL
    CRON -->|ทำงานในโปรเซสเดียวกับ BE| BE
```

---

## Flow 1: การสร้างและออกบิล (Bill Generation)

```mermaid
sequenceDiagram
    actor Admin
    participant FE as Frontend
    participant BE as Backend
    participant DB as MySQL

    Admin->>FE: จดค่ามิเตอร์ไฟ/น้ำของห้อง (เดือน/ปี)
    FE->>BE: POST /api/meters
    BE->>DB: INSERT meter_readings (units_used = generated column)

    Admin->>FE: กด "ออกบิล" สำหรับห้องนี้
    FE->>BE: POST /api/bills/generate {room_id, month, year}
    BE->>DB: หา meter_readings ของห้อง+เดือนนี้ (electric ต้องมีเสมอ)
    alt water_billing_type = unit
        BE->>DB: หา meter_readings ประเภท water ด้วย
    else water_billing_type = flat
        BE->>DB: ใช้ dorm_settings.water_flat_rate แทน (ไม่ต้องมี meter)
    end
    BE->>BE: total = rent + electric_units×rate + water_amount + other
    BE->>DB: INSERT bills (status = pending, active_key = room-month-year)
    BE-->>FE: บิลที่สร้างแล้ว + QR PromptPay
```

**จุดสำคัญ:** ออกบิลไม่ได้ถ้ายังไม่ได้จดมิเตอร์ไฟของเดือนนั้น (throw error) — ต้องจดมิเตอร์ก่อนออกบิลเสมอ ยกเว้นค่าน้ำที่เลือกโหมด `flat` ได้ไม่ต้องมี meter reading

---

## Flow 2: วงจรบิลจนถึงจ่ายเงิน (รวม cron job)

```mermaid
flowchart TD
    A[bill สร้างใหม่\nstatus=pending] --> B{ผู้เช่าจ่ายก่อน\nครบกำหนดไหม}
    B -->|ยัง, เหลือ 3 วัน| C[cron 08:00\nส่ง Telegram เตือนบิล]
    C --> D{เหลือ 1 วัน}
    D -->|ยัง| E[cron 09:00\nส่งเตือนครั้งสุดท้าย]
    B -->|จ่ายแล้ว| F[POST /api/payments\nแนบสลิป, status=pending_verify]
    F --> G{Admin ตรวจสลิป}
    G -->|อนุมัติ| H[PUT /payments/:id/verify\nbill.status = paid]
    G -->|ปฏิเสธ| I[PUT /payments/:id/reject\nแจ้งผู้เช่าให้ส่งใหม่]
    E --> J{ยังไม่จ่ายเมื่อถึง due_date}
    J -->|ใช่| K[cron 00:05\nbill.status = overdue]
    K --> L[cron 08:30\nแจ้งเตือนวันที่ 1,3,7,14,30\nหลังครบกำหนด — decaying frequency]
    L --> F
```

**จุดสำคัญ:** บิล `paid` ไม่ได้ set อัตโนมัติแค่เพราะมีคนอัปโหลดสลิป — ต้องรอแอดมิน verify ก่อนเสมอ (กันสลิปปลอม/จ่ายผิดยอด) และการแจ้งเตือนค้างชำระใช้ **decaying frequency** (แจ้งเฉพาะวันที่ 1/3/7/14/30 หลังครบกำหนด) แทนการยิงทุกวัน เพื่อลด alert fatigue ของผู้เช่า

---

## Flow 3: สัญญาเช่า → ย้ายออก → คืนเงินประกัน

```mermaid
sequenceDiagram
    actor Admin
    actor Tenant
    participant BE as Backend
    participant DB as MySQL
    participant CRON as Cron (01:00 ทุกวัน)

    Admin->>BE: POST /api/contracts (สร้างสัญญาใหม่)
    BE->>DB: INSERT contracts (status=active) + rooms.status=occupied

    Note over CRON,DB: ทุกวันเวลา 01:00
    CRON->>DB: หาสัญญาที่ end_date < วันนี้ และยัง active
    CRON->>DB: UPDATE status='expired'
    CRON->>Tenant: แจ้งเตือน Telegram สัญญาหมดอายุ

    Tenant->>BE: POST /api/move-out (ขอย้ายออก, เสนอ move_out_date)
    BE->>DB: INSERT move_out_requests (status=pending)

    Admin->>BE: GET /move-out/:id/deposit-preview
    BE-->>Admin: พรีวิวยอดคืนเงินประกัน (ก่อนอนุมัติจริง)

    Admin->>BE: PUT /move-out/:id/approve\n(ระบุ actual_move_out_date จริงหลังตรวจห้อง)
    BE->>DB: UPDATE move_out_requests status=approved
    BE->>DB: UPDATE contracts status=terminated
    BE->>DB: UPSERT deposits (deduction ถ้ามีค่าปรับ/ความเสียหาย, status=refunded)
    BE->>DB: UPDATE rooms status=available
```

**จุดสำคัญ:** คำนวณเงินคืนประกันใช้ `actual_move_out_date` (วันที่แอดมินยืนยันหลังตรวจสภาพห้องจริง) เสมอ **ไม่ใช่** `move_out_date` ที่ผู้เช่าเสนอมาตอนแรก เพราะสองค่านี้อาจไม่ตรงกัน (เช่น ผู้เช่าขอย้าย 1 ธ.ค. แต่จริงๆย้ายออกจริง 5 ธ.ค.)

---

## Flow 4: Telegram Notification & Account Linking

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as Backend
    participant Bot as Telegram Bot Process
    participant TG as Telegram

    User->>FE: กด "เชื่อมต่อ Telegram" ในหน้าโปรไฟล์
    FE->>BE: POST /api/telegram/generate-link
    BE->>BE: สร้าง token อายุ 10 นาที (telegram_link_tokens)
    BE-->>FE: deep link เช่น https://t.me/BotName?start=<token>
    User->>TG: เปิดลิงก์ → กด Start ใน Telegram
    TG->>Bot: ส่ง /start <token> มาที่ bot
    Bot->>BE: POST /api/telegram/link\n(header X-Internal-Secret)
    BE->>BE: ตรวจ token ยังไม่หมดอายุ
    BE->>BE: UPDATE users.telegram_chat_id
    Bot->>User: ตอบกลับใน Telegram ว่าผูกสำเร็จ

    Note over BE,TG: ต่อจากนี้ cron job ต่างๆ (bill reminder,\noverdue notice, contract expired) จะส่งข้อความ\nไปยัง telegram_chat_id นี้โดยตรง ถ้า user\nไม่ได้ปิด toggle แจ้งเตือนประเภทนั้นไว้
```

**จุดสำคัญด้านความปลอดภัย:** endpoint `POST /api/telegram/link` **ไม่ได้ใช้ JWT cookie ของ user** เพราะถูกเรียกจาก bot process (server-to-server) ไม่ใช่ browser — ป้องกันด้วย shared secret (`BOT_INTERNAL_SECRET`) ผ่าน header `X-Internal-Secret` แทน ถ้า secret รั่วจะสามารถผูก telegram chat id เข้ากับ user คนไหนก็ได้ ต้องเก็บ secret นี้ให้ปลอดภัยเหมือน `JWT_SECRET`

---

## เอกสารที่เกี่ยวข้อง

- API endpoints ทั้งหมด → [`backend/docs/API.md`](../backend/docs/API.md)
- โครงสร้างตาราง/ERD → [`database/DATABASE.md`](../database/DATABASE.md)
- วิธี deploy → [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md)