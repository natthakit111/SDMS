//frontend/lib/api/axiosInstance.js

import axios from "axios";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/**
 * ⚠️ SECURITY MIGRATION (localStorage → httpOnly cookie):
 *
 * เดิม request interceptor ดึง JWT จาก localStorage มาแนบเป็น
 * `Authorization: Bearer <token>` เอง — จุดอ่อนคือ JWT ต้องถูกเก็บไว้ใน
 * localStorage ที่ JS ใดๆ ก็ตาม (รวมถึง malicious script จาก XSS) อ่านออก
 * ไปได้ตรงๆ
 *
 * เปลี่ยนมาใช้ httpOnly cookie แทน:
 *   - ไม่ต้องมี request interceptor แนบ header อีกต่อไป — แค่ตั้ง
 *     `withCredentials: true` เบราว์เซอร์จะแนบ cookie (รวม httpOnly
 *     token) ให้เองอัตโนมัติทุก request ไปยัง backend
 *   - JS ฝั่ง frontend "มองไม่เห็น" ค่า token เลย แม้จะมี XSS เกิดขึ้นจริง
 *     ก็ขโมย token ไปใช้ที่อื่นไม่ได้
 *
 * ปัญหาที่ตามมา: เดิม response interceptor เช็ค "มี token ใน localStorage
 * ไหม" เพื่อแยกเคส (ก) เคย login มาก่อนแล้วโดน 401 เพราะ token หมดอายุ/ถูก
 * revoke → ต้อง force logout ออกจาก (ข) ยังไม่เคย login เลย ไปแตะ endpoint
 * ที่ต้อง auth เฉยๆ → ไม่ต้อง redirect (ปกติ)
 * พอย้ายไป httpOnly cookie แล้ว JS อ่าน token ไม่ได้อีกต่อไป เลยเช็คแบบ
 * เดิมไม่ได้
 *
 * ทางแก้: ให้ backend ตั้งคุกกี้คู่กัน 2 ตัวตอน login/OAuth สำเร็จ
 *   - `token`      → httpOnly, เก็บ JWT จริง (JS แตะไม่ได้)
 *   - `auth_hint`  → ไม่ใช่ httpOnly, เก็บแค่ "1" เฉยๆ ไม่มีข้อมูลอ่อนไหว
 *                    เลย มีไว้ให้ JS เช็คได้ว่ามี session อยู่ไหม โดยไม่ต้อง
 *                    แตะ token จริง ต้อง set/clear คู่กับ token เสมอ
 *                    (ดู backend/authController.js + oauth.routes.js
 *                    ที่ต้องแก้เพิ่มให้ set/clear คุกกี้นี้คู่กันด้วย)
 */
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // ส่ง cookie (httpOnly token) ไปกับทุก request อัตโนมัติ
});

// ไม่มี request interceptor แนบ Authorization header อีกต่อไป —
// เบราว์เซอร์แนบ cookie ให้เองผ่าน withCredentials ด้านบนแล้ว

const readCookie = (name) => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const hasSessionHint = () => readCookie("auth_hint") === "1";

// ⚠️ ใหม่: แนบ CSRF token (double-submit cookie pattern) ทุก request —
// จำเป็นเพราะ cookie `token` ใช้ sameSite: 'none' (frontend/backend คนละ
// โดเมน) เกราะป้องกัน CSRF ที่ sameSite เคยให้ฟรีๆ จึงหายไป ต้องแนบ header
// นี้เพื่อพิสูจน์ว่า request มาจากหน้าเว็บของเราจริง (เว็บอื่นอ่านค่า cookie
// นี้ไม่ได้ เลยปลอม header ให้ตรงไม่ได้) ดู csrf.middleware.js ฝั่ง backend
api.interceptors.request.use((config) => {
  const csrfToken = readCookie("csrf_token");
  if (csrfToken) {
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});

const clearSessionHint = () => {
  // ลบคุกกี้ auth_hint ฝั่ง client (คุกกี้ธรรมดา ไม่ใช่ httpOnly จึงลบเองได้
  // — ส่วน token จริงต้องให้ backend เป็นคนสั่งลบผ่าน endpoint logout เท่านั้น
  // เพราะ JS แตะไม่ถึง)
  if (typeof document !== "undefined") {
    document.cookie = "auth_hint=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  }
};

// ── Response: จัดการ 401 ─────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined") {
      // 🔥 สำคัญ: force logout เฉพาะตอน "เคยมี session อยู่แล้ว" แต่โดน 401
      // (เดิมเช็คจาก token ใน localStorage — ตอนนี้เช็คจาก auth_hint แทน
      // เพราะ token จริงอยู่ใน httpOnly cookie ที่ JS อ่านไม่ได้แล้ว)
      if (error.response?.status === 401 && hasSessionHint()) {
        clearSessionHint();
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;