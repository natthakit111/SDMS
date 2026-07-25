/**
 * services/pdf.service.js
 *
 * จัดการ Puppeteer (headless Chromium) เป็น singleton instance
 * เพื่อไม่ต้อง launch browser ใหม่ทุกครั้งที่มีการ export PDF
 * (การ launch ใหม่ทุก request จะช้าและกิน memory มาก — ไม่เหมาะกับ production)
 */
const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

let browserPromise = null;

async function launchBrowser() {
  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // สำคัญมากใน Docker container ที่ /dev/shm เล็ก
    ],
  };

  // ใน Docker (Alpine) เราติดตั้ง Chromium ของระบบผ่าน apk แล้วชี้ path ผ่าน env นี้
  // (ดู Dockerfile: PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser)
  // ถ้าไม่มี env นี้ (เช่นรันบนเครื่อง dev) จะใช้ Chromium ที่ Puppeteer bundle มาเองตามปกติ
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  return puppeteer.launch(launchOptions);
}

function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null; // reset เพื่อให้ลอง launch ใหม่ในครั้งถัดไปถ้า fail
      throw err;
    });
  }
  return browserPromise;
}

/**
 * แปลง HTML string เป็น PDF buffer
 * @param {string} html
 * @param {import('puppeteer').PDFOptions} options
 * @returns {Promise<Buffer>}
 */
async function htmlToPdfBuffer(html, options = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      ...options,
    });
    return buffer;
  } finally {
    await page.close();
  }
}

// ปิด browser ให้เรียบร้อยเมื่อ process กำลังจะออก
async function closeBrowser() {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch (err) {
      logger.error('Error closing puppeteer browser', err);
    } finally {
      browserPromise = null;
    }
  }
}

process.on('SIGINT', closeBrowser);
process.on('SIGTERM', closeBrowser);

module.exports = { getBrowser, htmlToPdfBuffer, closeBrowser };