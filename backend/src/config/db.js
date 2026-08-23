const mysql = require('mysql2/promise');

// Railway inject DATABASE_URL อัตโนมัติเมื่อเพิ่ม MySQL plugin
// รองรับทั้ง DATABASE_URL และ individual env vars
const CONNECTION_LIMIT = parseInt(process.env.DB_POOL_SIZE) || 10;

function getPoolConfig() {
  if (process.env.DATABASE_URL) {
    return { uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: CONNECTION_LIMIT, queueLimit: 0, timezone: '+07:00', charset: 'utf8mb4' };
  }
  return {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'sdms',
    waitForConnections: true,
    connectionLimit:    CONNECTION_LIMIT,
    queueLimit:         0,
    timezone:           '+07:00',
    charset:            'utf8mb4',
  };
}

const pool = mysql.createPool(getPoolConfig());

// ⚠️ FIX: `timezone: '+07:00'` ข้างบนบอกแค่ driver ว่า "ให้ตีความค่าที่ดึงมา
// จาก MySQL เป็นเวลา +07:00 เสมอ" แต่ไม่ได้ทำให้ MySQL SERVER เองใช้เวลาไทย
// จริง — NOW()/CURRENT_TIMESTAMP/CURDATE() ยังอ่านจากนาฬิกาของเครื่อง server
// เอง (global_tz='SYSTEM') ซึ่งอาจไม่ใช่เวลาไทยเลย (เช่น container บน cloud
// มักตั้งเป็น UTC หรือ timezone อื่นตาม host) ทำให้ driver ตีความค่าที่ผิด
// อยู่แล้วซ้ำเข้าไปอีกชั้น เวลาที่แสดงคลาดเคลื่อนได้หลายชั่วโมงถึงข้ามวัน
// (เช่น recorded_at ของมิเตอร์/การชำระเงินผิด, หรือ utility_rates ที่เพิ่ง
// บันทึกหายไปจาก getCurrentRate() เพราะ CURDATE() ของ server ยังนับเป็น
// เมื่อวาน) บังคับให้ session ของทุก connection ใช้ +07:00 จริงๆ ที่นี่
// ครั้งเดียว แก้ปัญหานี้ให้ครบทุกจุดที่พึ่งเวลาอัตโนมัติของ MySQL ในระบบ
// หมายเหตุ: connection ที่ event นี้ส่งมาเป็น raw (non-promise) connection
// เสมอ แม้ pool เองจะสร้างจาก mysql2/promise ก็ตาม ต้องใช้ callback style
// ธรรมดา เรียก .query(sql).catch() ตรงๆ จะพังทันที ("not a promise")
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+07:00'", (err) => {
    if (err) console.error('❌  ตั้งค่า MySQL session time_zone ไม่สำเร็จ:', err.message);
  });
});

const testConnection = async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅  MySQL connected successfully');
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = { pool, testConnection };
