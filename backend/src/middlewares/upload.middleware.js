/**
 * middlewares/upload.middleware.js
 * Multer + Cloudinary — รูปและ PDF เก็บบน cloud ไม่หายเมื่อ redeploy
 *
 * ⚠️ FIX (2026-08, รอบ 2): เดิม controller อ่าน req.file.path ตรงๆ ซึ่งผิด
 * รูปแบบ (ไม่ใช่ URL เต็ม) — รอบแรกผมแก้โดยสร้าง URL เองด้วย cloudinary.url()
 * แต่ลืมใส่ "version" (v1234567890/) เข้าไปด้วย ทำให้ resource_type: 'raw'
 * (PDF) โหลดไม่ได้ (404) เพราะไฟล์แบบ raw ต้องมี version ใน URL ถึงจะ resolve
 *
 * แก้รอบนี้โดยไม่สร้าง URL เอง — multer-storage-cloudinary@4 เซ็ต
 * req.file.path = resp.secure_url ให้ตรงๆ อยู่แล้ว (มี version ติดมาถูกต้อง
 * เสมอ ดู node_modules/multer-storage-cloudinary/lib/index.js) ทุก
 * controller จึงอ่านจาก req.file.path ไม่ใช่ req.file.secure_url
 *
 * ⚠️ FIX (2026-08, รอบ 3): เดิมมี fallback เรียก cloudinary.api.resource()
 * ซ้ำทุกครั้งที่ req.file.secure_url ไม่มีค่า — แต่ lib เวอร์ชันที่ติดตั้งจริง
 * ไม่เคย set secure_url ให้เลย (set แค่ path/size/filename) ทำให้ fallback
 * นี้ทำงานทุกอัปโหลด 100% ของเวลา เสีย round-trip ไป Cloudinary Admin API
 * โดยเปล่าประโยชน์ เพราะไม่มี controller ไหนอ่าน req.file.secure_url เลย
 * (ทุกที่อ่าน req.file.path ซึ่งมีค่าถูกต้องอยู่แล้วตั้งแต่แรก) เอาออก
 *
 * ต้องติดตั้ง:
 *   npm install cloudinary multer-storage-cloudinary
 *
 * env vars ที่ต้องใส่ใน Railway:
 *   CLOUDINARY_CLOUD_NAME=xxx
 *   CLOUDINARY_API_KEY=xxx
 *   CLOUDINARY_API_SECRET=xxx
 */

const multer               = require('multer');
const cloudinary           = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ── Config Cloudinary ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_SIZE_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024;

// ── Map fieldname → Cloudinary folder + allowed formats ─────────────────────
const FIELD_CONFIG = {
  meter_image:   { folder: 'dormflow/meter-images',   resource_type: 'image', formats: ['jpg','jpeg','png','webp'] },
  payment_slip:  { folder: 'dormflow/payment-slips',  resource_type: 'image', formats: ['jpg','jpeg','png','webp'] },
  // type: 'authenticated' — Cloudinary บล็อกการเข้าถึงไฟล์ resource_type:
  // raw (PDF) แบบ public เป็นค่า default ของบัญชี (นโยบายความปลอดภัยฝั่ง
  // Cloudinary) ต้องอัปโหลดเป็น type: authenticated แล้วดาวน์โหลดผ่าน
  // signed URL (cloudinary.utils.private_download_url) เท่านั้นถึงจะได้ 200
  contract_file: { folder: 'dormflow/contracts',      resource_type: 'raw',   formats: ['pdf'], type: 'authenticated' },
  profile_image: { folder: 'dormflow/profiles',       resource_type: 'image', formats: ['jpg','jpeg','png','webp'] },
};

// ── สร้าง multer instance ต่อ fieldname ─────────────────────────────────────
function makeUpload(fieldname) {
  const cfg = FIELD_CONFIG[fieldname];

  const storage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => ({
      folder:        cfg.folder,
      resource_type: cfg.resource_type,
      public_id:     `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      ...(cfg.resource_type === 'raw' ? { format: 'pdf' } : {}),
      ...(cfg.type ? { type: cfg.type } : {}),
    }),
  });

  const fileFilter = (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const mimeOk = cfg.resource_type === 'raw'
      ? file.mimetype === 'application/pdf'
      : file.mimetype.startsWith('image/');

    if (!cfg.formats.includes(ext) || !mimeOk) {
      // ⚠️ message เดิม hardcode ภาษาไทย ไม่แปลตามภาษาที่ผู้ใช้เลือกไว้ —
      // errorHandler.js ส่ง code 'UNSUPPORTED_FILE_TYPE' + allowedFormats
      // ให้ frontend แปล/ใส่รายการ format แทนแล้ว ไม่ต้องพึ่ง err.message นี้
      const err = new Error('Unsupported file type');
      err.code = 'UNSUPPORTED_FILE_TYPE';
      err.statusCode = 400;
      err.allowedFormats = cfg.formats.join(', ');
      return cb(err);
    }
    cb(null, true);
  };

  return multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_BYTES } }).single(fieldname);
}

// ── Export เหมือนเดิมทุก controller ใช้ได้เลย ───────────────────────────────
const uploadMeterImage   = makeUpload('meter_image');
const uploadPaymentSlip  = makeUpload('payment_slip');
const uploadContractFile = makeUpload('contract_file');
const uploadProfileImage = makeUpload('profile_image');

module.exports = { uploadMeterImage, uploadPaymentSlip, uploadContractFile, uploadProfileImage };