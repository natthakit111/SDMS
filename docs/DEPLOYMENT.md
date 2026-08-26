# SDMS Deployment Guide — Railway (Backend + MySQL) + Vercel (Frontend)

> เวอร์ชันนี้แทนที่คู่มือ PM2/Nginx เดิม เพราะทีมเลือก deploy ผ่าน **Railway** (backend + MySQL) และ **Vercel** (frontend) แทนการเช่า VPS เอง — ถ้าย้าย provider ในอนาคต ดูโครงหลักการที่เหมือนกัน (env vars, CORS, cookie cross-site) แล้วปรับ platform-specific steps ใหม่

## ทำไม Railway ถึงเหมาะกับ backend ตัวนี้

Backend มี **cron job ทำงานอยู่ในตัว process เอง** (`node-cron`, ดู [`CRON_SETUP.md`](./CRON_SETUP.md)) — ต้องการ process ที่รันค้างตลอดเวลา ซึ่ง Railway รองรับได้ตรงๆ (ต่างจาก Vercel ที่เป็น serverless functions อายุสั้น ใช้รัน cron ในตัวแบบนี้ไม่ได้)

```
Vercel (Next.js frontend)  ──HTTPS + cookie──→  Railway (Express backend)
        yourapp.vercel.app                              yourapp.up.railway.app
                                                                  │
                                                          Railway MySQL plugin
```

---

## ส่วนที่ 1: Database บน Railway

1. สร้าง Railway project ใหม่ → **New → Database → Add MySQL**
2. Railway จะสร้าง instance ให้อัตโนมัติพร้อม connection variables (`MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`) — เปิดแท็บ **Variables** ของ service MySQL เพื่อดูค่าเหล่านี้
3. Import schema จริงเข้าไป — เชื่อมต่อผ่าน Railway CLI หรือ MySQL client ตัวไหนก็ได้ (เช่น TablePlus, DBeaver, mysql cli) ด้วยค่า connection ข้างต้น:

   ```bash
   mysql -h <MYSQLHOST> -P <MYSQLPORT> -u <MYSQLUSER> -p<MYSQLPASSWORD> <MYSQLDATABASE> < backend/database/schema.sql
   mysql -h <MYSQLHOST> -P <MYSQLPORT> -u <MYSQLUSER> -p<MYSQLPASSWORD> <MYSQLDATABASE> < backend/database/seed.sql
   ```

   > รัน `seed.sql` ต่อจาก `schema.sql` เข้า `<MYSQLDATABASE>` เดียวกันเสมอ (ไฟล์ไม่ได้ล็อกชื่อฐานข้อมูลไว้เอง) — ไม่งั้นจะไม่มีทางสร้างบัญชี admin เริ่มต้นได้ (ดู checklist ท้ายเอกสารนี้)
   >
   > ดูโครงสร้างตาราง/ERD ที่ [`backend/database/DATABASE.md`](../backend/database/DATABASE.md)

---

## ส่วนที่ 2: Backend บน Railway

1. **New → GitHub Repo** → เลือก repo `SDMS` → ตั้ง **Root Directory** เป็น `backend` (สำคัญมาก เพราะ repo เป็น monorepo มีทั้ง frontend/backend ในที่เดียว ถ้าไม่ตั้งจุดนี้ Railway จะพยายาม build จาก root แล้วหา `package.json` ไม่เจอ)
2. Railway auto-detect Node.js จาก `package.json` ได้เอง (`start`: `node server.js`) ไม่ต้องเขียน Dockerfile
3. ไปที่แท็บ **Variables** ของ backend service แล้วตั้งค่าตาม `.env.example` ให้ครบ โดยมีจุดที่ต้อง**ต่างจากตอน dev local**:

   | ตัวแปร | ค่าตอน deploy จริง |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | Railway ตั้ง `PORT` ให้อัตโนมัติผ่าน env variable ของตัวเอง — โค้ดที่ `server.js` อ่าน `process.env.PORT` อยู่แล้วจะใช้ค่านี้เองไม่ต้องกำหนดเพิ่ม |
   | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | คัดลอกจาก Variables ของ MySQL service (`MYSQLHOST` → `DB_HOST` เป็นต้น) — **ใช้ internal connection ถ้า service อยู่ project เดียวกัน** (Railway จะมี "Add Reference Variable" ให้ลิงก์ตรงจาก MySQL service ได้เลย ไม่ต้อง copy-paste ค่าเอง) |
   | `FRONTEND_URL` | URL จริงของ Vercel เช่น `https://sdms.vercel.app` (หรือ custom domain) — **ต้องตรงเป๊ะ ไม่มี `/` ท้าย** เพราะ `app.js` เช็คตรงตัวกับ allowlist นี้ (`corsOptions.origin`), ไม่ตรง = CORS บล็อกทันที |
   | `JWT_SECRET`, `BOT_INTERNAL_SECRET` | สุ่มใหม่ (`openssl rand -hex 32`) ห้ามใช้ค่าตัวอย่าง |
   | `COOKIE_CROSS_SITE` | `true` — frontend/backend อยู่คนละโดเมนกัน (`vercel.app` vs `railway.app`) จำเป็นต้องเปิด |
   | `COOKIE_SECURE` | `true` — Railway ให้ HTTPS มาโดย default อยู่แล้ว |
   | `CLOUDINARY_*`, `GOOGLE_CLIENT_ID/SECRET`, `TELEGRAM_BOT_TOKEN` ฯลฯ | ค่าจริงจาก provider แต่ละเจ้า |

4. Deploy — Railway จะ build+start อัตโนมัติทุกครั้งที่ push เข้า branch ที่ตั้งไว้ (ปกติ `main`)
5. ได้ URL สาธารณะจาก **Settings → Networking → Generate Domain** เช่น `sdms-backend-production.up.railway.app` (หรือผูก custom domain เองก็ได้)

> **Cron ไม่ต้องตั้งอะไรเพิ่ม** — เพราะรันอยู่ในตัว backend process อยู่แล้ว ตราบใดที่ Railway service ไม่ sleep (ดูหัวข้อถัดไป)

### ⚠️ ระวัง Railway "Serverless" / sleep mode

ถ้าเปิดโหมด serverless (service จะ sleep เมื่อไม่มี traffic) cron job ที่ควรรันตอนตี 1 หรือตี 5 โมงเช้าจะ**ไม่ทำงาน**เพราะ service หลับอยู่ ไม่มี HTTP request มาปลุก ให้ **ปิด serverless/sleep mode สำหรับ backend service นี้** (ตั้งเป็น always-on) ไม่งั้นบิลจะไม่ถูก mark overdue, สัญญาจะไม่ auto-expire, และการแจ้งเตือนจะไม่ส่งตามเวลาที่ตั้งไว้

### ⚠️ อย่าตั้ง Replica มากกว่า 1

เหตุผลเดียวกับ PM2 cluster mode ในคู่มือเดิม — ถ้า scale backend เป็นหลาย instance บน Railway cron จะรันซ้ำในทุก instance (ส่งข้อความ Telegram ซ้ำ, mark สถานะซ้ำ) ให้คง 1 instance เสมอ ถ้าจำเป็นต้อง scale จริงๆ ต้องแยก cron ออกเป็น service ต่างหาก

---

## ส่วนที่ 3: Frontend บน Vercel

1. Import repo เข้า Vercel → ตั้ง **Root Directory** เป็น `frontend` (เหตุผลเดียวกับ Railway — monorepo)
2. Framework Preset: Vercel จะ auto-detect เป็น Next.js เอง (`build`: `next build`)
3. ตั้ง Environment Variables ในหน้า Project Settings → Environment Variables:

   | ตัวแปร | ค่า |
   |---|---|
   | `BACKEND_URL` | URL backend จาก Railway (ไม่มี `/api` ต่อท้าย) เช่น `https://sdms-backend-production.up.railway.app` — ใช้ใน `next.config.mjs` (`rewrites()`) เท่านั้น server-side ล้วนๆ **ห้ามขึ้นต้นด้วย `NEXT_PUBLIC_`** |
   | `NEXT_PUBLIC_API_URL` | ตั้งเป็น `/api` (relative เฉยๆ ไม่ใช่ URL เต็ม) |

   > ⚠️ **อย่าตั้ง `NEXT_PUBLIC_API_URL` เป็น URL เต็มของ Railway ตรงๆ** (เช่น `https://xxx.up.railway.app/api`) แม้จะดูใช้งานได้ปกติตอน login ก็ตาม — เพราะ frontend/backend คนละโดเมนกัน ทำให้ cookie ที่ backend ตั้งให้ (`token`, `csrf_token`) กลายเป็น third-party cookie ซึ่ง browser รุ่นใหม่ (เช่น Chrome ที่ปิดกั้น third-party cookie เป็นค่าเริ่มต้น) จะเงียบๆ ปฏิเสธไม่เก็บ — อาการที่เจอคือ login ดูผ่านปกติ (เพราะอ่านจาก response body ตรงๆ) แต่พอเรียก endpoint ที่ต้องใช้ cookie จริง (เช่นเปลี่ยนรหัสผ่าน) จะพังด้วย "CSRF token ไม่ถูกต้อง" หรือ "No token provided" ทันที ต้องตั้งเป็น `/api` (relative) คู่กับ `BACKEND_URL` ด้านบนเพื่อให้ `next.config.mjs` proxy ผ่าน domain เดียวกับ frontend เองแทน (cookie จะกลายเป็น first-party ไม่ต้องพึ่ง browser privacy setting ของผู้ใช้แต่ละคนอีกเลย)

4. Deploy — Vercel build อัตโนมัติทุก push, ได้ preview URL แยกต่างหากทุก PR ด้วย
5. ตั้ง production domain ที่ **Settings → Domains** (ใช้ `*.vercel.app` ฟรี หรือผูก custom domain ก็ได้)

> **สำคัญ:** ถ้าเปลี่ยน domain ของ Vercel ทีหลัง (เช่นจาก `*.vercel.app` เป็น custom domain) ต้องกลับไปแก้ `FRONTEND_URL` ที่ Railway backend ให้ตรงกับโดเมนใหม่ด้วยเสมอ ไม่งั้น CORS จะพังทันที

---

## ส่วนที่ 4: อัปเดต Google OAuth callback ให้ตรงโดเมนจริง

หลัง deploy เสร็จทั้งคู่ ต้องกลับไปแก้จุดนี้เป็นโดเมนจริงเสมอ ไม่งั้น login ผ่าน Google จะพัง:

- **Google Cloud Console** → OAuth 2.0 Client → Authorized redirect URIs → เพิ่ม `https://<railway-backend-domain>/api/auth/google/callback`

(ไม่มีการ login ด้วย Telegram — ไม่ต้องตั้งค่า BotFather `/setdomain` ตัว bot เอง (token/username) ยังต้องตั้งตามปกติสำหรับส่งการแจ้งเตือน)

---

## Checklist ก่อนขึ้นจริง

- [ ] MySQL บน Railway import schema (`backend/database/schema.sql`) เรียบร้อย — เช็คด้วย `SHOW TABLES;`
- [ ] รัน `backend/database/seed.sql` ด้วย — ไม่มีทางสร้างบัญชี admin เริ่มต้นทางอื่นเลย ถ้าข้ามขั้นตอนนี้จะ login เข้าระบบครั้งแรกไม่ได้
- [ ] รัน `npm run migrate:baseline` (จาก `backend/`) ครั้งเดียวหลัง import schema สดๆ ให้บันทึกว่าโครงสร้างล่าสุดถูกติดตั้งแล้ว (ดูรายละเอียดใน README หัวข้อ "Migration")
- [ ] Backend service ตั้ง Root Directory = `backend`, ปิด serverless/sleep mode, replica = 1
- [ ] Backend env ครบทุกตัว โดยเฉพาะ `FRONTEND_URL` ตรงกับ Vercel domain เป๊ะๆ (ไม่มี `/` ท้าย), `COOKIE_CROSS_SITE=true`, `COOKIE_SECURE=true`
- [ ] Frontend service ตั้ง Root Directory = `frontend`, `NEXT_PUBLIC_API_URL` ชี้ไป Railway backend + `/api`
- [ ] Google OAuth redirect URI อัปเดตเป็นโดเมนจริงแล้ว
- [ ] ทดสอบ login ทั้ง 2 แบบ (username/password, Google) บน production จริง — เช็คว่า cookie ถูกตั้งและอ่านข้ามโดเมนได้ (เปิด DevTools → Application → Cookies เช็คว่ามี `token`, `auth_hint`, `csrf_token`)
- [ ] ทดสอบ flow ครบวงจร: สร้างห้อง/สัญญา → จดมิเตอร์ → ออกบิล → จ่ายเงิน → แจ้งเตือน Telegram มาจริง
- [ ] รอดูวันถัดไปว่า cron รันตามเวลาจริงไหม (เช็ค Railway deploy logs ตอน 00:05 / 01:00 / 08:00 / 08:30 / 09:00 เวลาไทย) หรือเรียกทดสอบทันทีผ่าน `__test__` helper ตามที่อธิบายไว้ใน [`CRON_SETUP.md`](./CRON_SETUP.md)
- [ ] ตั้งการสำรองฐานข้อมูล — Railway มี backup ให้ในบาง plan แต่ควรเช็ค/ตั้งเพิ่มเองด้วย (`mysqldump` ผ่าน scheduled job ภายนอก) เผื่อไว้

---

## หมายเหตุเรื่องค่าใช้จ่าย (ณ ที่เขียนเอกสารนี้)

Railway ไม่มี free tier ถาวรแล้ว มีแค่ credit ทดลอง $5 ในช่วงแรก จากนั้นคิดค่าใช้จ่ายตาม resource จริงที่ใช้ (ขั้นต่ำ Hobby plan $5/เดือน) Vercel มี free tier (Hobby) สำหรับโปรเจคส่วนตัว/ไม่ใช่เชิงพาณิชย์ที่เพียงพอสำหรับ frontend ทั่วไป — ควรเช็คราคาปัจจุบันที่หน้าเว็บของแต่ละ provider โดยตรงก่อนตัดสินใจ เพราะราคา/เงื่อนไขมีการเปลี่ยนแปลงได้เรื่อยๆ