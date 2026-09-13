/**
 * utils/idValidation.js
 *
 * ตรวจสอบเลขบัตรประชาชนไทย (13 หลัก + เลขตรวจสอบหลักที่ 13 ตามสูตรมาตรฐาน)
 * และรูปแบบเลขพาสปอร์ต (ไม่มีสูตร checksum สากล — เช็คแค่รูปแบบตัวอักษร/ตัวเลข)
 */

const PASSPORT_REGEX = /^[A-Z0-9]{6,15}$/;

/**
 * เช็คเลขบัตรประชาชนไทย 13 หลัก ด้วยสูตรเลขตรวจสอบ (check digit):
 * เอาหลักที่ 1-12 คูณด้วยน้ำหนัก (13 - ตำแหน่ง) แล้วบวกกัน, เอาผลรวม mod 11,
 * เอา 11 ลบผลลัพธ์แล้ว mod 10 อีกที ต้องตรงกับหลักที่ 13
 * @param {string} id ต้องเป็นตัวเลขล้วน 13 หลัก (ตัดขีดคั่นออกก่อนแล้ว)
 * @returns {boolean}
 */
const isValidThaiIdChecksum = (id) => {
  if (!/^\d{13}$/.test(id || '')) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(id[i]) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === Number(id[12]);
};

/**
 * เช็ครูปแบบเลขพาสปอร์ต: ตัวอักษร A-Z และตัวเลข 6-15 ตัว (ไม่มี checksum
 * สากลให้เช็คเหมือนบัตรประชาชนไทย เพราะแต่ละประเทศออกกฎเลขไม่เหมือนกัน)
 * @param {string} passportNumber
 * @returns {boolean}
 */
const isValidPassportFormat = (passportNumber) =>
  PASSPORT_REGEX.test((passportNumber || '').toUpperCase());

/**
 * ตรวจสอบเลขบัตร/พาสปอร์ตตาม id_type ที่เลือก
 * @param {string} idNumber ค่าที่ตัดขีดคั่นออกแล้ว (frontend/route sanitizer ทำให้แล้ว)
 * @param {'thai_id'|'passport'} idType
 * @returns {boolean}
 */
const isValidIdNumber = (idNumber, idType) =>
  idType === 'passport'
    ? isValidPassportFormat(idNumber)
    : isValidThaiIdChecksum(idNumber);

module.exports = { isValidThaiIdChecksum, isValidPassportFormat, isValidIdNumber };
