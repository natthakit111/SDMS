require('dotenv').config();
const { __test__ } = require('./src/services/cron.service');

(async () => {
  console.log('=== เริ่มเทส cron job ===');
  await __test__.runSendOverdueNoticesNow();
  console.log('=== เทสเสร็จสิ้น ===');
  process.exit(0);
})();