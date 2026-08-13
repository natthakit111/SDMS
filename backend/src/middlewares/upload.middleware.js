/**
 * middlewares/upload.middleware.js
 * Multer + Cloudinary — รูปและ PDF เก็บบน cloud ไม่หายเมื่อ redeploy
 *
 * ⚠️ FIX (2026-08, รอบ 2): เดิม controller อ่าน req.file.path ตรงๆ ซึ่งผิด
 * รูปแบบ (ไม่ใช่ URL เต็ม) — รอบแรกผมแก้โดยสร้าง URL เองด้วย cloudinary.url()
 * แต่ลืมใส่ "version" (v1234567890/) เข้าไปด้วย ทำให้ resource_type: 'raw'
 * (PDF) โหลดไม่ได้ (404) เพราะไฟล์แบบ raw ต้องมี version ใน URL ถึงจะ resolve
 *
 * แก้รอบนี้โดยไม่สร้าง URL เอง — ใช้ req.file.secure_url ที่ Cloudinary
 * ส่งกลับมาให้ตรงๆ หลังอัปโหลดสำเร็จแทน (multer-storage-cloudinary spread
 * ผลลัพธ์เต็มของ Cloudinary ทับบน req.file object ให้อยู่แล้ว รวมถึง
 * secure_url ที่มี version ติดมาถูกต้องเสมอ ไม่ต้องมานั่งประกอบเอง)
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
  contract_file: { folder: 'dormflow/contracts',      resource_type: 'raw',   formats: ['pdf'] },
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
    }),
  });

  const fileFilter = (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const mimeOk = cfg.resource_type === 'raw'
      ? file.mimetype === 'application/pdf'
      : file.mimetype.startsWith('image/');

    if (!cfg.formats.includes(ext) || !mimeOk) {
      const err = new Error(`ไฟล์ประเภทนี้ไม่รองรับ อนุญาตเฉพาะ: ${cfg.formats.join(', ')}`);
      err.code = 'INVALID_FILE_TYPE';
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  };

  const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_BYTES } }).single(fieldname);

  // ── FIX: middleware ห่อทับอีกชั้น — เช็คว่า req.file.secure_url มาจริงไหม
  // (ควรมีมาให้อยู่แล้วจาก multer-storage-cloudinary เพราะมัน spread ผลลัพธ์
  // เต็มของ Cloudinary ทับบน req.file) ถ้าไม่มี (เช่น lib version เก่ามาก)
  // ค่อย fallback ไปดึงจาก Cloudinary Admin API ตรงๆ ด้วย public_id ที่รู้แน่ๆ
  return (req, res, next) => {
    upload(req, res, async (err) => {
      if (err) return next(err);
      if (req.file && !req.file.secure_url) {
        try {
          // fallback: บาง version ของ lib ไม่ spread secure_url มาให้ —
          // ไปถาม Cloudinary ตรงๆ ด้วย public_id ที่ได้ ให้ได้ค่าที่ถูกต้อง
          // แน่ๆ (รวม version) แทนที่จะเดา/ประกอบ URL เอง
          const result = await cloudinary.api.resource(req.file.filename, {
            resource_type: cfg.resource_type,
          });
          req.file.secure_url = result.secure_url;
        } catch (lookupErr) {
          return next(lookupErr);
        }
      }
      next();
    });
  };
}

// ── Export เหมือนเดิมทุก controller ใช้ได้เลย ───────────────────────────────
const uploadMeterImage   = makeUpload('meter_image');
const uploadPaymentSlip  = makeUpload('payment_slip');
const uploadContractFile = makeUpload('contract_file');
const uploadProfileImage = makeUpload('profile_image');

module.exports = { uploadMeterImage, uploadPaymentSlip, uploadContractFile, uploadProfileImage };