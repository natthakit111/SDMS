/**
 * server.js — Entry point (COMPLETE)
 */
require('dotenv').config()

const app                = require('./app')
const { testConnection } = require('./src/config/db')
const { initCronJobs }   = require('./src/services/cron.service')
const { initBot }        = require('./src/config/telegram')
const logger             = require('./src/utils/logger')

const PORT = process.env.PORT || 5000

// ⚠️ FIX: เดิมไม่เช็ค JWT_SECRET เลยตอน startup — ถ้าไม่ได้ตั้งค่า (หรือ
// ลืมเปลี่ยนจากค่าตัวอย่างใน .env.example) server จะรันขึ้นได้ตามปกติ
// เงียบๆ แล้วไปพังตอนมีคน login ครั้งแรกด้วย error ที่งงว่ามาจากไหน —
// เช็คให้จบตั้งแต่ต้นทาง ก่อน DB/server จะเริ่มทำงานเลย
const PLACEHOLDER_JWT_SECRET = 'change_this_to_a_long_random_string_in_production'
const validateEnv = () => {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret || jwtSecret.trim() === '') {
    logger.error('❌  ไม่ได้ตั้งค่า JWT_SECRET ใน .env — คัดลอกจาก .env.example แล้วตั้งเป็นค่าสุ่มยาวๆ (เช่น `openssl rand -hex 32`) ก่อนรัน server')
    process.exit(1)
  }
  if (jwtSecret === PLACEHOLDER_JWT_SECRET) {
    logger.error('❌  JWT_SECRET ยังเป็นค่าตัวอย่างจาก .env.example อยู่ — เปลี่ยนเป็นค่าสุ่มจริงก่อนรัน (เช่น `openssl rand -hex 32`)')
    process.exit(1)
  }
  if (jwtSecret.length < 16) {
    logger.error('❌  JWT_SECRET สั้นเกินไป (ต้องอย่างน้อย 16 ตัวอักษร) — ใช้ค่าสุ่มที่ยาวพอ เช่น `openssl rand -hex 32`')
    process.exit(1)
  }
}

const start = async () => {
  validateEnv()
  await testConnection()

  app.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`)
    logger.info(`📌 Environment: ${process.env.NODE_ENV || 'development'}`)
  })

  initCronJobs()
  initBot()
}

start()
