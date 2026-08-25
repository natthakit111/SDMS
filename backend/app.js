/**
 * app.js
 */

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
const cookieParser = require('cookie-parser');

const routes       = require('./src/routes/index');
const errorHandler = require('./src/middlewares/errorHandler');
const logger       = require('./src/utils/logger');

const app = express();

// ⚠️ FIX: ไม่เคยตั้ง trust proxy มาก่อนเลย ทำให้ req.ip ที่ express-rate-limit
// ใช้เป็น key แยกผู้ใช้แต่ละคน (สำหรับ authLimiter กัน brute-force login)
// ไม่ใช่ IP จริงของผู้ใช้ แต่เป็น IP ของ proxy hop ที่ใกล้ container ที่สุด
// แทน (ยืนยันจาก production log: express-rate-limit โยน
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR เพราะเจอ header X-Forwarded-For แต่
// trust proxy ปิดอยู่) — request chain จริงคือ browser → Vercel (Next.js
// rewrite proxy /api/* ไปที่ Railway) → Railway edge → container นี้ จึงมี
// 2 hop ที่ควร trust ตั้งเป็น 2 (ไม่ใช่ true/ไม่จำกัด เพราะจะเปิดช่องให้
// ปลอม X-Forwarded-For มา bypass rate-limit ได้)
// TODO: log ด้านล่างเป็นของชั่วคราวไว้ยืนยันว่าจำนวน hop ถูกต้องจริงจาก
// production — ลบทิ้งได้หลังเช็คแล้วว่า req.ip ตรงกับ IP จริงของผู้ใช้
app.set('trust proxy', 2);
app.use((req, res, next) => {
  if (req.headers['x-forwarded-for']) {
    logger.info('[trust-proxy-check]', {
      xForwardedFor: req.headers['x-forwarded-for'],
      resolvedIp: req.ip,
      ips: req.ips,
    });
  }
  next();
});

app.use(helmet());

/* =========================
   CORS CONFIG (FINAL)
========================= */
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin "${origin}" not allowed`));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'Pragma',
    'Expires',
    'Accept',
    'Origin',
    'X-Requested-With',
    'X-CSRF-Token', // ⚠️ ใหม่ — จำเป็นสำหรับ double-submit CSRF protection
  ],
  exposedHeaders: ['Content-Length','Content-Type'],
  optionsSuccessStatus: 200,
  preflightContinue: false,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ⚠️ SECURITY FIX: เดิมมี middleware ตรงนี้ที่ตั้ง
//   res.header('Access-Control-Allow-Origin', req.headers.origin)
// ซ้ำอีกรอบหลัง cors(corsOptions) — จุดนี้อันตรายมาก เพราะ echo origin
// ของ request กลับไปตรงๆ โดยไม่เช็ค allowlist เลย (ต่างจาก corsOptions
// ด้านบนที่เช็คถูกต้องอยู่แล้ว) รวมกับ Access-Control-Allow-Credentials:
// true แปลว่าเว็บไซต์ไหนก็ได้สามารถยิง credentialed request (แนบ cookie
// ของผู้ใช้ไปด้วย) มาที่ API นี้ และอ่าน response กลับไปได้ — เท่ากับ
// bypass CORS protection ทั้งหมดที่ตั้งไว้ด้านบน ลบทิ้งไปเลย ไม่ต้องมี
// middleware ซ้ำแบบนี้อีก เพราะ cors(corsOptions) จัดการให้ครบแล้ว
// (รวม preflight ผ่าน app.options('*', ...) ด้านบนด้วย)

/* =========================
   CACHE CONTROL
========================= */
app.set('etag', false);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

/* =========================
   BODY PARSER
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   COOKIE PARSER
   ⚠️ เพิ่มใหม่ — จำเป็นสำหรับ auth.middleware.js ที่อ่าน JWT จาก
   httpOnly cookie แทน Authorization header (migration จาก localStorage)
   ต้อง mount ก่อน routes เสมอ ไม่งั้น req.cookies จะเป็น undefined
========================= */
app.use(cookieParser());

/* =========================
   CSRF PROTECTION (double-submit cookie)
   ⚠️ เพิ่มใหม่ — จำเป็นเพราะ frontend/backend อยู่คนละโดเมนกัน จึงต้องใช้
   cookie sameSite: 'none' (ดู authController.js) ซึ่งเอาเกราะป้องกัน CSRF
   ที่ sameSite ให้ฟรีๆ ออกไป ต้องมีกลไกอื่นมาแทน ดู csrf.middleware.js
   ต้อง mount หลัง cookieParser (ต้องการ req.cookies.token)
========================= */
app.use(require('./src/middlewares/csrf.middleware'));

/* =========================
   LOGGER
========================= */
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

/* =========================
   STATIC FILES (ถ้าใช้)
========================= */
// app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

/* =========================
   ROUTES
========================= */
app.use('/api', routes);

/* =========================
   HEALTH CHECK
========================= */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

/* =========================
   ERROR HANDLER
========================= */
app.use(errorHandler);

module.exports = app;