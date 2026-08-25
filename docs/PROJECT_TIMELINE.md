# SDMS — Timeline โปรเจกต์ตั้งแต่เริ่มต้น

> รวบรวมจาก git history ทั้งหมด (152 commits, 2026-03-18 ถึงปัจจุบัน) โฟกัสที่ปัญหาสำคัญที่เคยเกิดขึ้นและการแก้ไข ไม่ใช่ทุก commit — ช่วงที่มีรายละเอียดละเอียดอยู่แล้ว (audit + QA testing) จะลิงก์ไปยังเอกสารเฉพาะแทนที่จะพิมพ์ซ้ำ

---

## เฟส 1 — เริ่มต้นโปรเจกต์ (18–24 มี.ค. 2026)

Initial commit วันที่ 18 มี.ค. จากนั้นพัฒนารัวๆ ต่อเนื่อง 7 วัน สร้างโครงระบบหลักเกือบทั้งหมดในช่วงนี้ (auth, payment, bill, meter, contract, move-out, settings, telegram, dark/light mode) commit message ส่วนใหญ่สั้นมาก ("update", "fix bill", "fix payment") ไม่ได้บันทึกรายละเอียดปัญหาไว้ ที่พอจับใจความได้:

- **21 มี.ค.** — ปัญหา deploy บน Vercel หลายจุดติดกัน: pnpm lockfile ไม่ตรง, CORS config ผิด, ต้องเปลี่ยนชื่อโฟลเดอร์ `frondend` → `frontend` (พิมพ์ผิดตั้งแต่แรก)
- **22 มี.ค.** — แก้ OAuth route, auth-context, หน้าโปรไฟล์ tenant, เชื่อมต่อ Telegram, เพิ่ม dark/light mode
- **23–24 มี.ค.** — ไล่แก้ทีละโมดูล: bill, payment, meters, settings, auth controller, tenant controller

จากนั้นโปรเจกต์หยุดพัฒนาไปประมาณ 4 เดือน (ไม่มี commit ระหว่าง 25 มี.ค. – 24 ก.ค.)

---

## เฟส 2 — กลับมาพัฒนาต่อ (25–31 ก.ค. 2026)

- อัปเดต README, เปลี่ยนจาก `npm` เป็น `pnpm` ฝั่ง frontend
- เปลี่ยนชื่อฐานข้อมูลจาก `dormflow_db` → `SDMS_db` (ภายหลังยังเปลี่ยนอีกครั้งเป็น `sdms` ในเดือน ส.ค. — ดูเฟส 4)
- **29–31 ก.ค.** — ไล่แก้ auth, bill, meter, telegram, contract, moveOut, cron job อีกรอบ (commit `8dc25fe`)
- **31 ก.ค.** — merge เข้ากับ branch จาก repo อื่น (`SDM-v2`), ลบ Dockerfile/docker-compose ออก (ภายหลังถูกเพิ่มกลับมาใหม่ในเดือน ส.ค. ดูเฟส 4)

---

## เฟส 3 — เหตุการณ์สำคัญ: `.gitignore` พังจนไฟล์หายไปเงียบๆ (18 ส.ค. 2026)

ปัญหาที่กระทบมากที่สุดในประวัติโปรเจกต์: `.gitignore` เขียนไว้กว้างเกินไปจนไล่ยิงไฟล์ source code จริงประมาณ **77 ไฟล์** ไม่เคยถูก commit/push เข้า repo เลย ทำให้ clone ใหม่จากที่ไหนก็ตามพังทันที:

- **Backend:** `backend/src/utils/excelSafe.js` หายไป — ทำให้ **server พังตั้งแต่ startup** เพราะ `reportController.js` เรียกใช้ไฟล์นี้ตรงๆ (commit `34a214c`)
- **Frontend:** หายไปหลายไฟล์สำคัญ เช่น `admin-bottom-nav.tsx`, `date-picker-field.tsx`, `types/index.ts`, `lib/notifications.ts` — ทำให้ **build ฝั่ง frontend ล้มเหลวทุกครั้งที่ clone ใหม่** (commit `8bb43c3`)
- ในรอบเดียวกันนี้ยังพบว่า Google OAuth strategy ถูก register แบบไม่มีเงื่อนไข ทำให้ server พังตอน startup ถ้าไม่ได้ตั้งค่า Google credentials — แก้พร้อมกัน

**การแก้ไข:** กู้ไฟล์ที่หายทั้งหมดกลับมา, เขียน `.gitignore` ใหม่ให้แคบลง, และถือโอกาสนี้ **เพิ่มมาตรการความปลอดภัยที่ยังไม่มี** ไปพร้อมกัน — `helmet` (security headers) และ `express-rate-limit` บน endpoint ที่อ่อนไหว (login/register/forgot-password/reset-password) ซึ่งเป็น rate limiter ตัวเดียวกับที่ทดสอบยืนยันว่าทำงานถูกต้องในรายงาน QA วันที่ 25 ส.ค. (เคส AUTH-09)

---

## เฟส 4 — เก็บงานให้พร้อม deploy จริง (1–19 ส.ค. 2026)

ช่วงนี้เพิ่มฟีเจอร์และเก็บงานสำคัญหลายอย่างต่อเนื่อง ก่อนเข้าสู่รอบ audit ครั้งแรก:

- เพิ่มการจัดการบิล/สัญญาที่สมบูรณ์ขึ้น, CSRF protection middleware, OAuth code management
- เพิ่มการเช็คเบอร์โทรชนกันตอนสร้างผู้เช่าใหม่
- ปรับปรุง UI/accessibility, เปลี่ยนธีมสีทั้งเว็บเป็น "DormSmart cream/navy/gold"
- เขียน database schema + seed data ใหม่ทั้งชุด, รวมศูนย์การจัดการ URL รูปภาพผ่าน Cloudinary
- เพิ่ม `nixpacks.toml` รองรับ Puppeteer/Chromium (สำหรับสร้าง PDF)
- ขยาย README ให้ครบถ้วน — **สิ้นสุดที่ commit `fd86f2c` (19 ส.ค.)** ซึ่งเป็นจุดที่ audit รอบแรกใช้อ้างอิง

---

## เฟส 5 — Audit เต็มระบบครั้งแรก (20 ส.ค. 2026)

ตรวจโค้ดทั้งหมดแบบละเอียด (backend, frontend, database schema, deploy readiness) พบ **44 จุด** (Critical 4 · High 9 · Medium 14 · Low 17) รวมถึงบั๊กร้ายแรงอย่าง race condition ตอนจองห้อง (จองซ้อนได้ 2 สัญญา) และช่องโหว่ tenant ยกเลิกสัญญาตัวเองได้โดยไม่ต้องผ่านแอดมิน

📄 รายละเอียดเต็ม: [`docs/AUDIT_REPORT_2026-08-20.md`](AUDIT_REPORT_2026-08-20.md)

---

## เฟส 6 — สปรินต์แก้บั๊กตาม audit (21–24 ส.ค. 2026)

แก้ปัญหาจาก audit ไปอย่างน้อย **34 จาก 44 จุด** ในเวลา 4 วัน จุดที่แก้สำคัญๆ:

- ป้องกันจองห้องซ้อนด้วย row lock (`a69da34`)
- บังคับยกเลิกสัญญาผ่าน flow ย้ายออกที่แอดมินอนุมัติเท่านั้น (`fcd7b5e`)
- บังคับเปลี่ยนรหัสผ่าน admin เริ่มต้นก่อนใช้งานจริง (`9a03cf0`)
- เพิ่ม index ที่ cron job ต้องใช้ (`0471d3b`), เพิ่มระบบ migration + CI/CD + Dockerfile (`62ebb25`, `8e2a922`)
- invalidate token รีเซ็ตรหัสผ่านเก่า + เช็ค `is_active` ตอนรีเซ็ต (`af4a163`)
- เพิ่ม automated test ชุดแรกให้ backend (`a4f62b9`, `4805dab`)
- แก้ error message ดิบหลายจุดให้เป็นข้อความที่เข้าใจง่าย/แปลภาษาแล้ว
- เพิ่มชุด `TEST_CASES.xlsx`/`.csv` (101 เคส) สำหรับ regression test รอบต่อไป

---

## เฟส 7 — QA Regression Testing รอบแรก (25 ส.ค. 2026 — วันนี้)

ทดสอบจริง 50 เคสแรกจาก `TEST_CASES.xlsx` (AUTH-01–MET-03) กับแอปที่รันจริง 2 รอบ (agent อัตโนมัติ + ทวนสอบเองทุกข้อ) ผลลัพธ์: **PASS 39 · FAIL 7 · BLOCKED 4**

พบว่า 2 ใน 7 ที่ FAIL คือจุดที่ audit เฟส 5 บอกให้แก้ไปแล้ว แต่ **แก้ไม่สมบูรณ์**:
- `password_must_change` (เฟส 6) บล็อกแค่ฝั่ง frontend ไม่ใช่ backend — เรียก API ตรงข้าม flow ได้
- tenant ยกเลิกสัญญาเอง (เฟส 6) โค้ดบล็อกถูกต้องแล้วจริง แต่เอกสาร API ไม่ได้อัปเดตให้ตรง

อีก 4 จุดเป็นปัญหาใหม่ที่ audit เฟส 5 ไม่เคยตรวจเจอ (ลบผู้เช่าที่มีสัญญา active ได้, reset password ตอบ 500 error ดิบ, ดาวน์โหลดไฟล์สัญญาใช้งานไม่ได้เพราะ Cloudinary บล็อก raw file, redirect role ผิดหน้า)

อีก 1 จุด (**AUTH-09**) เจอภายหลังจากที่ผู้ใช้ลองทดสอบเองบนเว็บ deploy จริง (`sdms-nt.vercel.app`) แล้วแจ้งว่าไม่เจอพฤติกรรมตามรายงาน — ทดสอบซ้ำยืนยันว่า rate limiter ผ่านบน local dev (รันแค่ 1 process) แต่ **ใช้งานไม่ได้จริงบน production** เพราะ backend รันหลาย instance พร้อมกัน ทำให้ counter ของ `express-rate-limit` แยกกันคนละ instance — เป็นเครื่องเตือนใจว่าเคสอื่นในรายงานนี้ทดสอบบน local dev เป็นหลัก ยังไม่ได้ยืนยันครบทุกข้อบน production

📄 รายละเอียดเต็ม (ตาราง 50 เคส + ติดตามผล audit ทีละข้อ): [`docs/QA_TEST_REPORT_2026-08-25.md`](QA_TEST_REPORT_2026-08-25.md)

---

## เฟส 8 — แก้ไขครบทั้ง 7 จุด FAIL (25 ส.ค. 2026 — วันนี้ ช่วงเย็น)

แก้และทดสอบยืนยันซ้ำครบทั้ง 7 จุดจากเฟส 7 ภายในวันเดียวกัน:

- **TEN-08** — เพิ่มเช็คสัญญา active ก่อนลบผู้เช่า
- **AUTH-14** — เพิ่มเช็ค `password_must_change` ที่ backend middleware ไม่ใช่แค่ frontend
- **AUTH-11** — ครอบ try/catch กัน error ส่งอีเมลหลุดเป็น 500 ดิบ
- **CON-09** — เปลี่ยนไฟล์สัญญาเป็น Cloudinary `type: authenticated` + ดาวน์โหลดผ่าน signed URL (ไฟล์เก่าก่อนแก้ยังใช้ไม่ได้ ต้องอัปโหลดใหม่)
- **CON-07** — แก้เอกสาร `API.md` ให้ตรงกับพฤติกรรมจริง
- **AUTH-10** — แยก redirect กรณี "ไม่มี session" กับ "login ผิด role"
- **AUTH-09** — เปลี่ยน rate limiter เป็น Redis-backed store (ทดสอบยืนยันด้วย Redis container จริง รัน 2 instance พร้อมกัน) **ต้อง provision Redis + ตั้งค่า `REDIS_URL` บน production เพิ่มเติมก่อนจะมีผลจริง**

📄 รายละเอียดการแก้ + ผลทดสอบแต่ละข้อ: ส่วนที่ 3 ใน [`docs/QA_TEST_REPORT_2026-08-25.md`](QA_TEST_REPORT_2026-08-25.md)

---

## สถานะปัจจุบัน / ยังไม่ได้ทำ

- เคส 51–101 ใน `TEST_CASES.xlsx` (บิล, การชำระเงิน, แจ้งซ่อม, ประกาศ, ย้ายออก+เงินประกัน, ตั้งค่าระบบ, รายงาน) — **ยังไม่ได้ทดสอบ**
- **AUTH-09 ต้อง provision Redis + ตั้งค่า `REDIS_URL` บน production** — โค้ดพร้อมแล้ว รอ infrastructure
- ไฟล์สัญญาเก่าที่อัปโหลดไว้ก่อนแก้ CON-09 ยังดาวน์โหลดไม่ได้ ต้องอัปโหลดใหม่ทับทีละสัญญา
- 10 จุดจาก audit เฟส 5 ที่ยังไม่พบหลักฐานว่าแก้ (ส่วนใหญ่เป็น Low) — ดูรายละเอียดใน QA report เฟส 7
