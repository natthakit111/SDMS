# SDMS — Cron Jobs

> **อัปเดต:** เอกสารเวอร์ชันก่อนหน้านี้เขียนไว้ตอนที่ระบบยังเป็น Next.js mock data บน Vercel (`/api/cron/check-overdue` + `vercel.json`) — ตอนนี้ backend เป็น Express จริงแล้ว และ cron ไม่ได้ทำงานผ่าน HTTP endpoint หรือ Vercel Cron อีกต่อไป เอกสารนี้เขียนใหม่ทั้งหมดให้ตรงกับ `backend/src/services/cron.service.js`

## Cron ทำงานยังไง

ระบบ**ไม่ใช้** Vercel Cron / GitHub Actions / external cron service ใดๆ ทั้งสิ้น cron job ทั้งหมดรันอยู่ **ในโปรเซสเดียวกับ backend** ด้วยไลบรารี [`node-cron`](https://www.npmjs.com/package/node-cron) ถูกเรียกครั้งเดียวตอน server start:

```js
// backend/server.js
const { initCronJobs } = require('./src/services/cron.service')
// ...
initCronJobs()
```

แปลว่า **ตราบใดที่ backend process รันอยู่** (เช่นผ่าน PM2) cron ก็ทำงานอัตโนมัติ ไม่ต้องตั้งค่าอะไรเพิ่มที่ระบบปฏิบัติการหรือบริการภายนอก

## รายการ Job ทั้งหมด (เวลาไทย, Asia/Bangkok)

| เวลา | Job | หน้าที่ |
|---|---|---|
| 00:05 | `markOverdueBillsJob` | เปลี่ยน `bills.status` เป็น `overdue` เมื่อเลย `due_date` |
| 01:00 | `expireContractsJob` | เปลี่ยน `contracts.status` เป็น `expired` เมื่อเลย `end_date` + แจ้งเตือนผู้เช่าทาง Telegram |
| 08:00 | `sendBillRemindersJob` | แจ้งเตือนบิลที่ใกล้ครบกำหนด (เหลือ 3 วัน) |
| 08:30 | `sendOverdueNoticesJob` | แจ้งเตือนบิลค้างชำระ — **เฉพาะวันที่ 1, 3, 7, 14, 30** หลังครบกำหนด (decaying frequency ไม่ใช่ทุกวัน) |
| 09:00 | `sendFinalRemindersJob` | แจ้งเตือนครั้งสุดท้าย (เหลือ 1 วันก่อนครบกำหนด) |

ดู flow diagram ประกอบที่ [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md#flow-2-วงจรบิลจนถึงจ่ายเงิน-รวม-cron-job)

## กันการแจ้งเตือนซ้ำ

ทุก job ที่ส่ง Telegram จะเช็คตาราง `notifications_log` ก่อนส่งเสมอ (`notification_type` + `DATE(sent_at) = CURDATE()`) — ถ้า process รันซ้ำโดยไม่ตั้งใจในวันเดียวกัน จะไม่ส่งข้อความซ้ำหาผู้เช่า

## ⚠️ ข้อควรระวังตอน deploy: อย่ารัน backend แบบ cluster mode

เพราะ cron ผูกอยู่กับ process ของ backend เอง ถ้า deploy ด้วย PM2 แบบ cluster mode (เช่น `pm2 start server.js -i 4`) จะมี **4 instance ต่างรัน cron ของตัวเอง** → ส่งข้อความแจ้งเตือนซ้ำ 4 เท่า และ mark สถานะซ้ำโดยไม่จำเป็น (ถึงจะไม่ error เพราะ query เป็น idempotent แต่ก็สิ้นเปลืองและเสี่ยง race condition)

**แนะนำ:** รัน backend แบบ fork mode เดียว (`pm2 start server.js --name sdms-backend` ไม่ใส่ `-i`) ถ้าจำเป็นต้อง scale backend จริงๆ ให้แยก cron ออกเป็น service ต่างหาก (เช่น รัน `cron.service.js` เป็น process แยกที่เชื่อม DB เดียวกัน แล้วปิด `initCronJobs()` ใน instance อื่นด้วย env flag)

## ทดสอบ job ด้วยตัวเอง (ไม่ต้องรอถึงเวลาจริง)

`cron.service.js` export ฟังก์ชันรันตรงไว้ให้ใต้ `__test__` สำหรับเรียกทดสอบโดยไม่ต้องแก้ cron pattern:

```js
const { __test__ } = require('./src/services/cron.service')

// รัน job ใดก็ได้ทันที เช่น
await __test__.runSendOverdueNoticesNow()
await __test__.runMarkOverdueBillsNow()
await __test__.runExpireContractsNow()
```

เขียนสคริปต์เล็กๆ เรียกฟังก์ชันพวกนี้ผ่าน `node -e` หรือใน REPL เพื่อเช็คว่า Telegram ส่งข้อความออกจริงก่อน deploy ได้เลย โดยไม่ต้องรอข้ามคืน

## เปลี่ยนเวลา/เพิ่ม job ใหม่

แก้ cron pattern ได้ตรงๆ ในไฟล์ `backend/src/services/cron.service.js` (syntax แบบ standard cron: `นาที ชั่วโมง วัน เดือน วัน-ในสัปดาห์`) เช่น

```js
cron.schedule('5 0 * * *', runMarkOverdueBillsNow, { timezone: 'Asia/Bangkok' })
```

อย่าลืม deploy ใหม่ (restart backend process) หลังแก้ เพราะ cron ผูกกับ process ตอน start เท่านั้น