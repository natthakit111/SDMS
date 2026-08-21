/**
 * utils/logger.js
 * Winston logger — writes to console (dev) and files (prod).
 */
const path = require('path')
const { createLogger, format, transports } = require('winston')

// ⚠️ FIX: เดิม filename เป็น relative path ('logs/error.log') ซึ่ง resolve
// จาก process.cwd() ไม่ใช่ตำแหน่งไฟล์นี้ — ถ้า process ถูกสั่งรันจาก working
// directory อื่น (เช่น PM2/systemd ที่ตั้ง cwd ไม่ตรง หรือรันจากโฟลเดอร์อื่น)
// log จะไปเขียนผิดที่หรือ error เพราะโฟลเดอร์ปลายทางไม่มีอยู่จริง แก้ให้ผูก
// กับตำแหน่งไฟล์นี้เสมอ (backend/logs/) ไม่ว่าจะรันจาก cwd ไหนก็ตาม
const LOG_DIR = path.join(__dirname, '..', '..', 'logs')

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) =>
      stack ? `${timestamp} [${level.toUpperCase()}] ${message}\n${stack}`
             : `${timestamp} [${level.toUpperCase()}] ${message}`
    )
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error' }),
    new transports.File({ filename: path.join(LOG_DIR, 'combined.log') }),
  ],
})

module.exports = logger
