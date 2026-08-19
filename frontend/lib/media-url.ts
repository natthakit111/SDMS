/**
 * lib/media-url.ts
 *
 * รวม logic การสร้าง URL รูปภาพ/ไฟล์ที่เดิม copy วางซ้ำกันอยู่ 7 จุด
 * (imgUrl / slipUrl ใน tenant/bills, tenant/maintenance, admin/bills,
 * admin/payment-history, admin/meters, admin/maintenance, admin/payments)
 * มาไว้ที่เดียว พร้อมเพิ่ม Cloudinary transform เพื่อลดขนาดรูปที่โหลดจริง
 *
 * ปัญหาเดิม: รูปทั้งหมด (มิเตอร์, สลิปจ่ายเงิน) มาจาก Cloudinary แต่ frontend
 * ใช้ URL ตรงๆ ที่ backend ส่งมา ไม่มี transform เลย — เท่ากับโหลดไฟล์ต้นฉบับ
 * เต็มขนาด (มักมาจากกล้องมือถือ หลาย MB/รูป) ทุกครั้งที่เปิดดู ทั้งที่ใน UI
 * แสดงแค่ thumbnail/preview เล็กๆ
 *
 * วิธีแก้: Cloudinary รองรับ on-the-fly transform ผ่าน URL segment ทันที
 * ไม่ต้องแก้อะไรฝั่ง backend หรือไฟล์ที่อัปโหลดไปแล้วเลย แค่แทรก
 * "w_800,q_auto,f_auto" (หรือขนาดอื่นตามบริบท) เข้าไปหลัง "/upload/"
 * ในตัว URL ก็พอ:
 *
 *   เดิม: https://res.cloudinary.com/xxx/image/upload/v123/sdms/meters/abc.jpg
 *   ใหม่: https://res.cloudinary.com/xxx/image/upload/w_800,q_auto,f_auto/v123/sdms/meters/abc.jpg
 *
 *   w_800   — resize ให้กว้างไม่เกิน 800px (พอสำหรับดูในดีไทล์/lightbox บนมือถือ)
 *   q_auto  — Cloudinary เลือกคุณภาพบีบอัดที่เหมาะสมให้อัตโนมัติ
 *   f_auto  — ส่ง format ที่เบาที่สุดที่ browser รองรับ (เช่น WebP/AVIF)
 */

const CLOUDINARY_UPLOAD_MARKER = "/upload/";

export type MediaSize = "thumb" | "detail";

// thumb = ใช้กับรูปเล็กในตาราง/การ์ด, detail = ใช้กับรูปในดีไทล์/lightbox
const TRANSFORM_BY_SIZE: Record<MediaSize, string> = {
  thumb: "w_200,q_auto,f_auto",
  detail: "w_800,q_auto,f_auto",
};

/**
 * แปลง path ที่ backend ส่งมา (อาจเป็น Cloudinary URL เต็ม หรือ relative path
 * เก่าที่ยังไม่ได้ migrate) ให้เป็น URL ที่ใช้ <img src> ได้ตรงๆ
 * พร้อมแทรก Cloudinary transform ถ้าเป็น Cloudinary URL
 */
export function getMediaUrl(
  path: string | null | undefined,
  size: MediaSize = "detail",
): string | null {
  if (!path) return null;

  // Cloudinary URL เต็ม (เคสปกติของระบบตอนนี้ — เก็บไฟล์ที่ Cloudinary ทั้งหมด)
  if (path.startsWith("http")) {
    if (
      path.includes("res.cloudinary.com") &&
      path.includes(CLOUDINARY_UPLOAD_MARKER)
    ) {
      const transform = TRANSFORM_BY_SIZE[size];
      return path.replace(
        CLOUDINARY_UPLOAD_MARKER,
        `${CLOUDINARY_UPLOAD_MARKER}${transform}/`,
      );
    }
    // URL http อื่นที่ไม่ใช่ Cloudinary (เช่น dev เก่า) — ส่งตรงๆ ไม่แตะ
    return path;
  }

  // Path แบบ relative (legacy ก่อน migrate ไป Cloudinary) — ต่อกับ backend URL
  // ตรงๆ เหมือนเดิม ไม่มี transform ให้ (ไม่ใช่ Cloudinary เลยทำไม่ได้)
  return `${process.env.NEXT_PUBLIC_API_URL ?? ""}/${path}`;
}
