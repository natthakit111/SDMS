/**
 * controllers/reportController.js
 *
 * Use Case: "ส่งออกข้อมูลรายงาน (PDF / Excel)"
 *
 * Routes:
 *   GET /api/reports/revenue?year=&format=excel|pdf  — monthly revenue report
 *   GET /api/reports/rooms?format=excel               — room occupancy report
 *   GET /api/reports/payments?month=&year=&format=    — payment summary
 *   GET /api/reports/system-export                    — export ข้อมูลระบบทั้งหมด (Excel, multi-sheet)
 */
const { excelSafe } = require('../utils/excelSafe');
const path = require('path');
const ExcelJS = require('exceljs')
const PDFDocument = require('pdfkit')
const BillModel  = require('../models/bill.model')
const { pool }   = require('../config/db')
const { thaiMonthYear, thaiDate } = require('../utils/dateHelper')

const THAI_MONTHS = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const fmt = (n) => Number(n || 0).toFixed(2)

// ── Revenue Report ────────────────────────────────────────────
const getRevenueReport = async (req, res, next) => {
  try {
    const year   = parseInt(req.query.year)   || new Date().getFullYear()
    const format = (req.query.format || 'excel').toLowerCase()
    const data   = await BillModel.getMonthlyRevenue(year)

    if (format === 'excel') {
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Smart Dormitory'
      const ws = wb.addWorksheet(`รายรับ ${year + 543}`)

      // Title
      ws.mergeCells('A1:G1')
      ws.getCell('A1').value = `รายงานรายรับประจำปี ${year + 543}`
      ws.getCell('A1').font  = { bold: true, size: 14 }
      ws.getCell('A1').alignment = { horizontal: 'center' }

      // Headers
      ws.addRow([])
      const headerRow = ws.addRow(['เดือน','บิลทั้งหมด','ชำระแล้ว','ค่าเช่า','ค่าไฟ','ค่าน้ำ','รวม (฿)'])
      headerRow.font = { bold: true }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } }
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }

      ws.columns = [
        { key: 'month', width: 14 },
        { key: 'bills', width: 12 },
        { key: 'paid',  width: 12 },
        { key: 'rent',  width: 14 },
        { key: 'elec',  width: 14 },
        { key: 'water', width: 14 },
        { key: 'total', width: 16 },
      ]

      let grandTotal = 0
      data.forEach(d => {
        const total = parseFloat(d.total_billed || 0)
        grandTotal += total
        ws.addRow([
          THAI_MONTHS[d.bill_month],
          d.bill_count,
          d.paid_count,
          fmt(d.total_rent),
          fmt(d.total_electric),
          fmt(d.total_water),
          fmt(total),
        ])
      })

      // Grand total row
      const totalRow = ws.addRow(['รวมทั้งปี', '', '', '', '', '', fmt(grandTotal)])
      totalRow.font = { bold: true }
      totalRow.getCell(7).numFmt = '#,##0.00'

      ws.eachRow(row => {
        row.eachCell(cell => {
          cell.border = { top: {style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} }
          cell.alignment = { vertical: 'middle' }
        })
      })

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename=revenue_${year}.xlsx`)
      await wb.xlsx.write(res)
      return res.end()
    }

    // PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=revenue_${year}.pdf`)
    doc.pipe(res)

    // --- ลงทะเบียนฟอนต์ไทย (ต้องทำก่อนเรียกใช้ .font() เสมอ) ---
    const fontRegular = path.join(__dirname, '../assets/fonts/Sarabun-Regular.ttf');
    const fontBold = path.join(__dirname, '../assets/fonts/Sarabun-Bold.ttf');
    doc.registerFont('Sarabun', fontRegular);
    doc.registerFont('Sarabun-Bold', fontBold);

    doc.font('Sarabun-Bold').fontSize(18).text(`รายงานรายรับประจำปี ${year + 543}`, { align: 'center' })
    doc.font('Sarabun').fontSize(10).text(`สร้างเมื่อ: ${new Date().toLocaleDateString('th-TH')}`, { align: 'center' })
    doc.moveDown(1.5)

    // Simple table
    const cols = [80, 70, 70, 90, 90, 90, 100]
    const headers = ['เดือน','บิลทั้งหมด','ชำระแล้ว','ค่าเช่า','ค่าไฟ','ค่าน้ำ','รวม (฿)']
    let x = 50, y = doc.y

    // Header row
    doc.rect(x, y, cols.reduce((a,b)=>a+b,0), 20).fill('#1a1a2e')
    doc.font('Sarabun-Bold').fillColor('white').fontSize(9)
    let cx = x
    headers.forEach((h, i) => { doc.text(h, cx + 3, y + 5, { width: cols[i]-6 }); cx += cols[i] })
    doc.fillColor('black')
    y += 20

    let grand = 0
    data.forEach((d, idx) => {
      const total = parseFloat(d.total_billed || 0)
      grand += total
      if (idx % 2 === 0) doc.rect(x, y, cols.reduce((a,b)=>a+b,0), 18).fill('#f8f7f4')
      doc.font('Sarabun').fillColor('#1a1a2e').fontSize(8.5)
      const row = [THAI_MONTHS[d.bill_month], d.bill_count, d.paid_count, fmt(d.total_rent), fmt(d.total_electric), fmt(d.total_water), fmt(total)]
      cx = x
      row.forEach((v, i) => { doc.text(String(v), cx + 3, y + 4, { width: cols[i]-6 }); cx += cols[i] })
      y += 18
    })

    // Total
    doc.rect(x, y, cols.reduce((a,b)=>a+b,0), 20).fill('#e8e6ff')
    doc.font('Sarabun-Bold').fillColor('#1a1a2e').fontSize(9)
    doc.text(`รวมทั้งปี: ${Number(grand).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`, x + 3, y + 5)
    doc.end()

  } catch (err) { next(err) }
}

// ── Room Occupancy Report ─────────────────────────────────────
const getRoomsReport = async (req, res, next) => {
  try {
    const format = (req.query.format || 'excel').toLowerCase()
    const [rows] = await pool.query(`
      SELECT r.room_number, r.floor, r.room_type, r.base_rent, r.status,
             CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
             t.phone AS tenant_phone,
             c.start_date, c.end_date, c.rent_amount
      FROM rooms r
      LEFT JOIN contracts c ON c.room_id = r.room_id AND c.status = 'active'
      LEFT JOIN tenants t ON c.tenant_id = t.tenant_id
      ORDER BY r.floor, r.room_number
    `)

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('ข้อมูลห้องพัก')

    ws.mergeCells('A1:J1')
    ws.getCell('A1').value = 'รายงานสถานะห้องพัก'
    ws.getCell('A1').font  = { bold: true, size: 14 }
    ws.getCell('A1').alignment = { horizontal: 'center' }
    ws.addRow([])

    const hRow = ws.addRow(['ห้อง','ชั้น','ประเภท','ค่าเช่าตั้ง','สถานะ','ผู้เช่า','เบอร์โทร','วันเริ่ม','วันสิ้นสุด','ค่าเช่าสัญญา'])
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } }
    ws.columns = [10,8,12,14,12,20,14,14,14,14].map(w => ({ width: w }))

    const statusMap = { available: 'ว่าง', occupied: 'มีผู้เช่า', maintenance: 'ซ่อมบำรุง' }
    rows.forEach(r => ws.addRow([
      excelSafe(r.room_number), r.floor, excelSafe(r.room_type), fmt(r.base_rent),
      statusMap[r.status] || r.status,
      excelSafe(r.tenant_name) || '-', excelSafe(r.tenant_phone) || '-',
      r.start_date ? new Date(r.start_date).toLocaleDateString('th-TH') : '-',
      r.end_date ? new Date(r.end_date).toLocaleDateString('th-TH') : '-',
      r.rent_amount ? fmt(r.rent_amount) : '-',
    ]))

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=rooms_report.xlsx')
    await wb.xlsx.write(res)
    return res.end()
  } catch (err) { next(err) }
}

// ── Payment Summary Report ────────────────────────────────────
// query params รองรับ (ทั้งหมด optional ยกเว้น format):
//   month, year          — กรองตามงวดบิล (เดิม เก็บไว้ตามหลัง)
//   status                — pending_verify | verified | rejected
//   payment_method        — qr_promptpay | cash | bank_transfer
//   search                — ค้นชื่อผู้เช่า / เลขห้อง / เลขบิล (LIKE, parameterized)
// ไม่ส่ง filter ตัวไหนมา = ไม่กรองด้วยเงื่อนไขนั้น (ต่างจากเดิมที่บังคับ
// month/year เสมอ) — เพื่อให้ตรงกับหน้า Payments ของ admin ที่ export
// ตาม filter บนหน้าจอ (status/method/search) ไม่ใช่ตามเดือน
const getPaymentsReport = async (req, res, next) => {
  try {
    const month  = req.query.month ? parseInt(req.query.month) : null
    const year   = req.query.year  ? parseInt(req.query.year)  : null
    const status = req.query.status || null
    const method = req.query.payment_method || null
    const search = req.query.search ? String(req.query.search).trim() : null
    const format = (req.query.format || 'excel').toLowerCase()

    const conditions = []
    const params = []

    if (month) { conditions.push('b.bill_month = ?'); params.push(month) }
    if (year)  { conditions.push('b.bill_year = ?');  params.push(year) }
    if (status) { conditions.push('p.status = ?'); params.push(status) }
    if (method) { conditions.push('p.payment_method = ?'); params.push(method) }
    if (search) {
      // ค้นครอบชื่อผู้เช่า / เลขห้อง / เลขบิล — parameterized ทั้งหมด
      // ป้องกัน SQL Injection (ห้าม concat string ของ search เข้า query ตรงๆ)
      conditions.push(`(
        CONCAT(t.first_name,' ',t.last_name) LIKE ?
        OR r.room_number LIKE ?
        OR CAST(p.bill_id AS CHAR) LIKE ?
      )`)
      const like = `%${search}%`
      params.push(like, like, like)
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const [rows] = await pool.query(`
      SELECT p.payment_id, p.bill_id, p.paid_at, p.amount_paid, p.payment_method, p.status,
             r.room_number,
             CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
             b.bill_month, b.bill_year,
             u.username AS verified_by
      FROM payments p
      JOIN bills b ON p.bill_id = b.bill_id
      JOIN rooms r ON b.room_id = r.room_id
      JOIN tenants t ON p.tenant_id = t.tenant_id
      LEFT JOIN users u ON p.verified_by = u.user_id
      ${whereClause}
      ORDER BY p.paid_at DESC
    `, params)

    // ── ชื่อ sheet/หัวรายงาน ปรับตามว่ามี filter เดือน/ปีไหม ──
    const periodLabel = (month && year) ? `${THAI_MONTHS[month]} ${year + 543}` : 'ทั้งหมด'

    const methodMap = { qr_promptpay: 'QR PromptPay', cash: 'เงินสด', bank_transfer: 'โอนเงิน' }
    const statusMap = { pending_verify: 'รอตรวจสอบ', verified: 'ยืนยันแล้ว', rejected: 'ปฏิเสธ' }

    // ── สรุปยอด: แยก "ยอดรวมที่แสดง" (ทุกแถวตาม filter) กับ "ยอดที่
    // ยืนยันแล้ว" (เฉพาะ verified) เสมอ ไม่ว่าจะกรอง status อะไรมา —
    // เพื่อให้ตัวเลขชัดเจนไม่กำกวมไม่ว่าจะ filter แบบไหน
    let totalShown = 0
    let totalVerified = 0
    rows.forEach(r => {
      const amount = parseFloat(r.amount_paid || 0)
      totalShown += amount
      if (r.status === 'verified') totalVerified += amount
    })

    // ── ชื่อไฟล์: ใส่เดือน/ปีถ้ามี filter, ไม่งั้นใช้วันที่ export แทน ──
    const filenameSuffix = (month && year)
      ? `${month}_${year}`
      : new Date().toISOString().slice(0, 10)

    if (format === 'excel') {
      const sheetName = `การชำระ ${periodLabel}`.slice(0, 31) // ExcelJS จำกัดชื่อ sheet ไม่เกิน 31 ตัวอักษร

      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet(sheetName)

      ws.mergeCells('A1:H1')
      ws.getCell('A1').value = `รายงานการชำระเงิน ${periodLabel}`
      ws.getCell('A1').font  = { bold: true, size: 14 }
      ws.getCell('A1').alignment = { horizontal: 'center' }
      ws.addRow([])

      const hRow = ws.addRow(['ห้อง','ผู้เช่า','จำนวน (฿)','วิธีชำระ','วันที่ชำระ','สถานะ','ตรวจสอบโดย','เบอร์บิล'])
      hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } }
      ws.columns = [10,20,14,14,16,14,16,10].map(w => ({ width: w }))

      rows.forEach(r => {
        ws.addRow([
          excelSafe(r.room_number), excelSafe(r.tenant_name), fmt(r.amount_paid),
          methodMap[r.payment_method] || r.payment_method,
          new Date(r.paid_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }),
          statusMap[r.status] || r.status,
          excelSafe(r.verified_by) || '-',
          r.payment_id,
        ])
      })

      ws.addRow([])
      const totalShownRow = ws.addRow(['','ยอดรวมที่แสดง (ตาม filter)', fmt(totalShown)])
      totalShownRow.font = { bold: true }
      const totalVerifiedRow = ws.addRow(['','ยอดรวมที่ยืนยันแล้ว', fmt(totalVerified)])
      totalVerifiedRow.font = { bold: true, color: { argb: 'FF15803D' } }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename=payments_${filenameSuffix}.xlsx`)
      await wb.xlsx.write(res)
      return res.end()
    }

    // PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=payments_${filenameSuffix}.pdf`)
    doc.pipe(res)

    // --- ลงทะเบียนฟอนต์ไทย (ต้องทำก่อนเรียกใช้ .font() เสมอ) ---
    const fontRegular = path.join(__dirname, '../assets/fonts/Sarabun-Regular.ttf');
    const fontBold = path.join(__dirname, '../assets/fonts/Sarabun-Bold.ttf');
    doc.registerFont('Sarabun', fontRegular);
    doc.registerFont('Sarabun-Bold', fontBold);

    doc.font('Sarabun-Bold').fontSize(18).text(`รายงานการชำระเงิน ${periodLabel}`, { align: 'center' })
    doc.font('Sarabun').fontSize(10).text(`สร้างเมื่อ: ${new Date().toLocaleDateString('th-TH')}`, { align: 'center' })
    doc.moveDown(1.5)

    const cols = [50, 85, 55, 60, 75, 55, 65, 45]
    const headers = ['ห้อง','ผู้เช่า','จำนวน (฿)','วิธีชำระ','วันที่ชำระ','สถานะ','ตรวจสอบโดย','เบอร์บิล']
    let x = 50, y = doc.y

    // Header row
    doc.rect(x, y, cols.reduce((a,b)=>a+b,0), 20).fill('#1a1a2e')
    doc.font('Sarabun-Bold').fillColor('white').fontSize(8.5)
    let cx = x
    headers.forEach((h, i) => { doc.text(h, cx + 3, y + 5, { width: cols[i]-6 }); cx += cols[i] })
    doc.fillColor('black')
    y += 20

    rows.forEach((r, idx) => {
      if (y > 760) { doc.addPage(); y = 50 } // ขึ้นหน้าใหม่ถ้าเกินขอบล่าง A4
      if (idx % 2 === 0) doc.rect(x, y, cols.reduce((a,b)=>a+b,0), 18).fill('#f8f7f4')
      doc.font('Sarabun').fillColor('#1a1a2e').fontSize(8)
      const row = [
        r.room_number, r.tenant_name, fmt(r.amount_paid),
        methodMap[r.payment_method] || r.payment_method,
        new Date(r.paid_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }),
        statusMap[r.status] || r.status,
        r.verified_by || '-',
        r.payment_id,
      ]
      cx = x
      row.forEach((v, i) => { doc.text(String(v), cx + 3, y + 4, { width: cols[i]-6 }); cx += cols[i] })
      y += 18
    })

    // Totals
    if (y > 740) { doc.addPage(); y = 50 }
    doc.rect(x, y, cols.reduce((a,b)=>a+b,0), 20).fill('#e8e6ff')
    doc.font('Sarabun-Bold').fillColor('#1a1a2e').fontSize(9)
    doc.text(`ยอดรวมที่แสดง (ตาม filter): ${Number(totalShown).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`, x + 3, y + 5)
    y += 20
    doc.rect(x, y, cols.reduce((a,b)=>a+b,0), 20).fill('#e6f4ea')
    doc.font('Sarabun-Bold').fillColor('#15803D').fontSize(9)
    doc.text(`ยอดรวมที่ยืนยันแล้ว: ${Number(totalVerified).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿`, x + 3, y + 5)
    doc.end()
  } catch (err) { next(err) }
}

// ── Full System Export (all core tables → one .xlsx, multi-sheet) ─────
const getSystemExport = async (req, res, next) => {
  try {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Smart Dormitory'

    const addSheet = (name, headers, widths, dataRows) => {
      const ws = wb.addWorksheet(name)
      const hRow = ws.addRow(headers)
      hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } }
      ws.columns = widths.map(w => ({ width: w }))
      dataRows.forEach(r => ws.addRow(r))
      ws.eachRow(row => row.eachCell(cell => {
        cell.border = { top: {style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} }
      }))
    }

    // ── Sheet 0: ข้อมูลการ Export (metadata) ──────────────────────
    // เพิ่มใหม่: สร้างเมื่อไหร่, ใครสร้าง, สรุปว่าแต่ละ sheet คืออะไร —
    // สำคัญสำหรับไฟล์ backup/system export ที่อาจถูกเปิดดูภายหลังนาน ๆ
    // โดยคนละคนกับที่ export ตอนแรก
    const exportedByLabel = req.user?.username
      ? `${req.user.username}${req.user.role ? ` (${req.user.role})` : ''}`
      : (req.user?.user_id ? `user_id ${req.user.user_id}` : 'ไม่ทราบผู้ export')
    const infoWs = wb.addWorksheet('ข้อมูลการ Export')
    infoWs.columns = [{ width: 22 }, { width: 60 }]
    infoWs.addRow(['สร้างไฟล์เมื่อ', new Date().toLocaleString('th-TH')])
    infoWs.addRow(['สร้างโดย', exportedByLabel])
    infoWs.addRow([])
    infoWs.addRow(['Sheet', 'คำอธิบาย']).font = { bold: true }
    ;[
      ['ห้องพัก', 'สถานะห้องพักทั้งหมดในระบบ ณ เวลา export'],
      ['ผู้เช่า', 'รายชื่อผู้เช่าทั้งหมด (ไม่เฉพาะที่ active)'],
      ['สัญญาเช่า', 'สัญญาเช่าทั้งหมด เรียงตามรหัสสัญญาล่าสุดก่อน'],
      ['บิลค่าเช่า', 'บิลค่าเช่าทั้งหมด เรียงตามปี/เดือนล่าสุดก่อน'],
      ['การชำระเงิน', 'ทุก payment record ทุกสถานะ เรียงตามวันที่ชำระล่าสุดก่อน'],
    ].forEach(row => infoWs.addRow(row))
    infoWs.eachRow(row => row.eachCell(cell => {
      cell.border = { top: {style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} }
    }))

    // ── ห้องพัก ──
    // ⚠️ FIX: excelSafe() ครอบทุกฟิลด์ที่มาจาก user input (room_number,
    // room_type, tenant_name, phone) — ป้องกัน Formula Injection
    // ⚠️ เพิ่ม: พื้นที่ (area_sqm), เบอร์โทรผู้เช่าปัจจุบัน (เดิมต้องข้าม
    // ไปเปิด sheet ผู้เช่าแล้วจับคู่ชื่อเอาเอง), วันที่สร้างห้อง
    const [rooms] = await pool.query(`
      SELECT r.room_number, r.floor, r.room_type, r.area_sqm, r.base_rent, r.status,
             r.created_at,
             CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
             t.phone AS tenant_phone
      FROM rooms r
      LEFT JOIN contracts c ON c.room_id = r.room_id AND c.status = 'active'
      LEFT JOIN tenants t ON c.tenant_id = t.tenant_id
      ORDER BY r.floor, r.room_number
    `)
    addSheet('ห้องพัก',
      ['ห้อง','ชั้น','ประเภท','พื้นที่ (ตร.ม.)','ค่าเช่าตั้งต้น','สถานะ','ผู้เช่าปัจจุบัน','เบอร์โทรผู้เช่า','สร้างเมื่อ'],
      [10,8,12,14,14,12,20,16,18],
      rooms.map(r => [
        excelSafe(r.room_number), r.floor, excelSafe(r.room_type),
        r.area_sqm != null ? fmt(r.area_sqm) : '-',
        fmt(r.base_rent), r.status,
        excelSafe(r.tenant_name) || '-', excelSafe(r.tenant_phone) || '-',
        r.created_at ? new Date(r.created_at).toLocaleDateString('th-TH') : '-',
      ]))

    // ── ผู้เช่า ──
    // ⚠️ FIX: excelSafe() สำหรับ first_name, last_name, phone, email
    // ⚠️ เพิ่ม: room_number (join จากสัญญา active — แก้ปัญหาข้าม sheet
    // เชื่อมกันไม่ได้ที่เคยพบ), อีเมล, วันที่สมัคร
    // หมายเหตุ: ตั้งใจไม่ export id_card_number แม้จะมีในตาราง เพราะเป็น
    // ข้อมูลอ่อนไหวสูง ไม่ควรหลุดออกมาในไฟล์ export ถ้าไม่จำเป็นจริง ๆ
    const [tenants] = await pool.query(`
      SELECT t.tenant_id, t.first_name, t.last_name, t.phone, t.email, t.created_at,
             r.room_number
      FROM tenants t
      LEFT JOIN contracts c ON c.tenant_id = t.tenant_id AND c.status = 'active'
      LEFT JOIN rooms r ON c.room_id = r.room_id
      ORDER BY t.tenant_id
    `)
    addSheet('ผู้เช่า',
      ['รหัส','ชื่อ','นามสกุล','เบอร์โทร','อีเมล','ห้องปัจจุบัน','สมัครเมื่อ'],
      [8,14,14,14,20,12,18],
      tenants.map(t => [
        t.tenant_id, excelSafe(t.first_name), excelSafe(t.last_name),
        excelSafe(t.phone) || '-', excelSafe(t.email) || '-',
        excelSafe(t.room_number) || '-',
        t.created_at ? new Date(t.created_at).toLocaleDateString('th-TH') : '-',
      ]))

    // ── สัญญาเช่า ──
    // ⚠️ FIX: excelSafe() สำหรับ room_number, tenant_name
    // ⚠️ เพิ่ม: ค่ามัดจำ (deposit_amount) ที่หายไปจากของเดิมทั้งที่มีอยู่
    // ในตารางจริง, วันที่สร้างสัญญา
    const [contracts] = await pool.query(`
      SELECT c.contract_id, r.room_number, CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
             c.start_date, c.end_date, c.rent_amount, c.deposit_amount, c.status, c.created_at
      FROM contracts c
      JOIN rooms r ON c.room_id = r.room_id
      JOIN tenants t ON c.tenant_id = t.tenant_id
      ORDER BY c.contract_id DESC
    `)
    addSheet('สัญญาเช่า',
      ['รหัสสัญญา','ห้อง','ผู้เช่า','วันเริ่ม','วันสิ้นสุด','ค่าเช่า','ค่ามัดจำ','สถานะ','ทำสัญญาเมื่อ'],
      [10,10,20,14,14,12,12,12,18],
      contracts.map(c => [
        c.contract_id, excelSafe(c.room_number), excelSafe(c.tenant_name),
        c.start_date ? new Date(c.start_date).toLocaleDateString('th-TH') : '-',
        c.end_date ? new Date(c.end_date).toLocaleDateString('th-TH') : '-',
        fmt(c.rent_amount), fmt(c.deposit_amount), c.status,
        c.created_at ? new Date(c.created_at).toLocaleDateString('th-TH') : '-',
      ]))

    // ── บิลค่าเช่า ──
    // ⚠️ FIX: excelSafe() สำหรับ room_number, tenant_name
    // ⚠️ เพิ่ม: แยกยอดค่าเช่า/ค่าไฟ/ค่าน้ำ/ค่าอื่น ๆ (เดิมมีแค่ยอดรวม
    // ยอดเดียว ไม่พอสำหรับตรวจสอบย้อนหลังว่าแต่ละก้อนเท่าไหร่)
    const [bills] = await pool.query(`
      SELECT b.bill_id, r.room_number, CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
             b.bill_month, b.bill_year,
             b.rent_amount, b.electric_amount, b.water_amount, b.other_amount,
             b.total_amount, b.status, b.due_date, b.created_at
      FROM bills b
      JOIN rooms r ON b.room_id = r.room_id
      JOIN contracts c ON b.contract_id = c.contract_id
      JOIN tenants t ON c.tenant_id = t.tenant_id
      ORDER BY b.bill_year DESC, b.bill_month DESC
    `)
    addSheet('บิลค่าเช่า',
      ['รหัสบิล','ห้อง','ผู้เช่า','เดือน','ปี(พ.ศ.)','ค่าเช่า','ค่าไฟ','ค่าน้ำ','ค่าอื่นๆ','ยอดรวม','สถานะ','กำหนดชำระ','ออกบิลเมื่อ'],
      [10,10,20,10,10,12,12,12,12,12,12,14,18],
      bills.map(b => [
        b.bill_id, excelSafe(b.room_number), excelSafe(b.tenant_name),
        THAI_MONTHS[b.bill_month], b.bill_year + 543,
        fmt(b.rent_amount), fmt(b.electric_amount), fmt(b.water_amount), fmt(b.other_amount),
        fmt(b.total_amount), b.status,
        b.due_date ? new Date(b.due_date).toLocaleDateString('th-TH') : '-',
        b.created_at ? new Date(b.created_at).toLocaleDateString('th-TH') : '-',
      ]))

    // ── การชำระเงิน ──
    // ⚠️ FIX: excelSafe() สำหรับ room_number, tenant_name, verified_by
    // ⚠️ เพิ่ม: ผู้ตรวจสอบ (join users.username เหมือนที่ getPaymentsReport
    // ทำไว้แล้ว แต่ตัวนี้เดิมไม่มี), หมายเหตุการปฏิเสธ (remark)
    // หมายเหตุ: ตาราง payments ไม่มี created_at ในสคีมา (มีแค่ paid_at,
    // verified_at) จึงไม่ต้องเพิ่มคอลัมน์ timestamp เกินจากที่มีจริง
    const [payments] = await pool.query(`
      SELECT p.payment_id, r.room_number, CONCAT(t.first_name,' ',t.last_name) AS tenant_name,
             p.amount_paid, p.payment_method, p.status, p.paid_at, p.verified_at,
             u.username AS verified_by, p.remark
      FROM payments p
      JOIN bills b ON p.bill_id = b.bill_id
      JOIN rooms r ON b.room_id = r.room_id
      JOIN tenants t ON p.tenant_id = t.tenant_id
      LEFT JOIN users u ON p.verified_by = u.user_id
      ORDER BY p.paid_at DESC
    `)
    addSheet('การชำระเงิน',
      ['รหัส','ห้อง','ผู้เช่า','จำนวนเงิน','วิธีชำระ','สถานะ','วันที่ชำระ','วันที่ตรวจสอบ','ผู้ตรวจสอบ','หมายเหตุ'],
      [10,10,20,14,14,14,18,18,16,24],
      payments.map(p => [
        p.payment_id, excelSafe(p.room_number), excelSafe(p.tenant_name), fmt(p.amount_paid),
        p.payment_method, p.status,
        p.paid_at ? new Date(p.paid_at).toLocaleString('th-TH') : '-',
        p.verified_at ? new Date(p.verified_at).toLocaleString('th-TH') : '-',
        excelSafe(p.verified_by) || '-',
        excelSafe(p.remark) || '-',
      ]))

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=system_export_${new Date().toISOString().slice(0,10)}.xlsx`)
    await wb.xlsx.write(res)
    return res.end()
  } catch (err) { next(err) }
}

module.exports = { getRevenueReport, getRoomsReport, getPaymentsReport, getSystemExport }