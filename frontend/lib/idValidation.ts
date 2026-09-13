//frontend/lib/idValidation.ts
//
// mirror ของ backend/src/utils/idValidation.js — เช็คให้ตรงกันทั้ง client/server
// เพื่อไม่ให้ frontend ผ่านแต่ backend reject (ใช้ร่วมกันทั้งหน้า admin/tenants
// และ admin/contracts เพราะทั้งสองหน้าแก้ tenants.id_card_number ได้เหมือนกัน)

export const PASSPORT_REGEX = /^[A-Z0-9]{6,15}$/;

export function isValidThaiIdChecksum(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === Number(id[12]);
}

export function isValidPassportFormat(id: string): boolean {
  return PASSPORT_REGEX.test(id.toUpperCase());
}
