/**
 * utils/emailValidator.js
 *
 * เช็คว่า domain ของอีเมลมี MX record จริงไหม (คือมี mail server
 * รองรับการรับอีเมลของ domain นั้นอยู่จริง) — ไม่การันตี 100% ว่า
 * กล่องจดหมายของ user มีอยู่จริง (อันนั้นต้องยืนยันผ่านอีเมลแทน)
 * แต่กรองอีเมลมั่วๆ อย่าง test@notarealdomain123xyz.com ออกได้เกือบหมด
 */

const dns = require('dns').promises;

/**
 * @param {string} email
 * @returns {Promise<boolean>} true ถ้า domain มี MX record (หรือ A record สำรอง)
 */
const hasMxRecord = async (email) => {
  const domain = (email || '').split('@')[1];
  if (!domain) return false;

  try {
    const mxRecords = await dns.resolveMx(domain);
    return Array.isArray(mxRecords) && mxRecords.length > 0;
  } catch (err) {
    // ⚠️ บาง domain ใช้ A record แทน MX record ตรงๆ (ผิด spec แต่พบได้)
    // ลอง fallback เช็ค A record ก่อนตัดสินว่า invalid จริงๆ
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      try {
        const aRecords = await dns.resolve4(domain);
        return Array.isArray(aRecords) && aRecords.length > 0;
      } catch {
        return false;
      }
    }
    // DNS timeout หรือ error อื่นๆ ที่ไม่ใช่ "domain ไม่มีจริง"
    // → ไม่ควรบล็อก user เพราะเน็ตเราเองมีปัญหา ปล่อยผ่านไปดีกว่า
    return true;
  }
};

module.exports = { hasMxRecord };