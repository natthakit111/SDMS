/**
 * utils/rateLimitStore.js
 *
 * ⚠️ FIX: express-rate-limit ใช้ MemoryStore เป็นค่า default ซึ่งเก็บ
 * counter แยกกันคนละ instance ของ process — พอ deploy จริงที่ backend
 * รันมากกว่า 1 instance พร้อมกัน (load balanced) แต่ละ instance นับ
 * request ของตัวเองแยกกัน ไม่มี instance ไหนสะสมครบ limit สักที
 * (ยืนยันจากการทดสอบ production จริง: ยิง login ผิด 17 ครั้งติดกันไม่โดน
 * บล็อกเลย เพราะ request กระจายไปคนละ instance)
 *
 * ถ้าตั้งค่า REDIS_URL ไว้ ใช้ RedisStore แทน (นับ counter ใช้ร่วมกันทุก
 * instance จริง) ถ้าไม่ได้ตั้งค่า (เช่น local dev) fallback กลับไปใช้
 * MemoryStore เดิม — แจ้งเตือนไว้ให้เห็นชัดว่ากำลังรันแบบไม่ปลอดภัยสำหรับ
 * multi-instance
 */
const logger = require('./logger');

let cachedStoreFactory = null;

const getRateLimitStore = () => {
  if (cachedStoreFactory !== null) return cachedStoreFactory();

  if (!process.env.REDIS_URL) {
    logger.warn('[RateLimit] REDIS_URL ไม่ได้ตั้งค่า — ใช้ MemoryStore (นับ counter แยกกันคนละ instance ถ้า deploy แบบ multi-instance rate limit จะไม่ทำงานจริง)');
    cachedStoreFactory = () => undefined; // undefined = express-rate-limit ใช้ MemoryStore เอง
    return cachedStoreFactory();
  }

  const Redis = require('ioredis');
  const { RedisStore } = require('rate-limit-redis');

  const client = new Redis(process.env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 1 });
  client.on('error', (err) => logger.error('[RateLimit] Redis connection error', { error: err.message }));

  cachedStoreFactory = () => new RedisStore({
    sendCommand: (...args) => client.call(...args),
  });
  logger.info('[RateLimit] ใช้ RedisStore (counter ใช้ร่วมกันทุก instance)');
  return cachedStoreFactory();
};

module.exports = { getRateLimitStore };
