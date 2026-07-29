/**
 * utils/dateHelper.js
 * Date formatting helpers for Thai locale.
 */

const THAI_MONTHS = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const THAI_MONTHS_SHORT = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

/** "มีนาคม 2568" */
const thaiMonthYear = (month, year) => `${THAI_MONTHS[+month]} ${+year + 543}`

/** "มี.ค. 68" */
const thaiMonthYearShort = (month, year) => `${THAI_MONTHS_SHORT[+month]} ${(+year + 543).toString().slice(-2)}`

/** "15 มีนาคม 2568" */
const thaiDate = (dateStr) => {
  const d = new Date(dateStr)
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth() + 1]} ${d.getFullYear() + 543}`
}

/** Last day of given month — used for bill due dates */
const lastDayOfMonth = (month, year) => {
  const d = new Date(+year, +month, 0)
  return d.toISOString().split('T')[0]
}

/** Current month & year as { month, year } */
const currentMonthYear = () => {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

module.exports = { thaiMonthYear, thaiMonthYearShort, thaiDate, lastDayOfMonth, currentMonthYear }

/** "3 สิงหาคม 2569" — ล็อก timezone Asia/Bangkok กันวันที่เพี้ยนตอน server อยู่ UTC */
const thaiDateBangkok = (dateStr) => {
  const d = new Date(dateStr)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(d).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {})
  const day = parseInt(parts.day)
  const month = parseInt(parts.month)
  const year = parseInt(parts.year)
  return `${day} ${THAI_MONTHS[month]} ${year + 543}`
}

module.exports = Object.assign(module.exports, { thaiDateBangkok })
