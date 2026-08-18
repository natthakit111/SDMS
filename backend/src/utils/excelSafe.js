/**
 * ป้องกัน Excel/CSV Formula Injection: ถ้าค่าที่มาจาก user input ขึ้นต้นด้วย
 * =, +, -, @ โปรแกรม spreadsheet (Excel/Google Sheets) อาจตีความเป็นสูตรและ
 * รันคำสั่งได้เมื่อไฟล์ export ถูกเปิด — เติม ' นำหน้าเพื่อบังคับให้อ่านเป็น
 * ข้อความเฉยๆ (มาตรฐานตาม OWASP CSV Injection defense)
 */
const DANGEROUS_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

function excelSafe(value) {
  if (value === null || value === undefined) return value;

  const str = String(value);
  if (str.length > 0 && DANGEROUS_PREFIXES.includes(str[0])) {
    return `'${str}`;
  }
  return str;
}

module.exports = { excelSafe };
