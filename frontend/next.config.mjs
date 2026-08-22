/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // ⚠️ FIX: frontend (Vercel) กับ backend (Railway) อยู่คนละโดเมนกัน ทำให้
  // cookie (token/csrf_token) ที่ backend ตั้งให้ถูกมองเป็น third-party
  // cookie แม้จะตั้ง SameSite=None; Secure ถูกต้องแล้วก็ตาม เบราว์เซอร์รุ่น
  // ใหม่ (Chrome เป็นต้น) เริ่มบล็อก third-party cookie เป็นค่าเริ่มต้น ทำให้
  // login ดูเหมือนผ่าน (อ่านจาก response body ตรงๆ) แต่ cookie ไม่ถูกเก็บจริง
  // พอเรียก endpoint ที่ต้องใช้ cookie (เช่น เปลี่ยนรหัสผ่าน) เลยพัง
  //
  // แก้ด้วยการ proxy /api/* ผ่าน domain เดียวกับ frontend เอง — browser จะ
  // เห็นแค่ request ไป sdms-nt.vercel.app/api/... (same-origin) แล้ว Vercel
  // เป็นคนยิงต่อไป backend จริงให้ (server-to-server ไม่ผ่าน browser) cookie
  // ที่ backend ตั้งมาจึงถูกมองเป็น first-party ทันที ไม่ต้องพึ่งการตั้งค่า
  // privacy ของ browser แต่ละคนอีกเลย ต้องตั้ง env var BACKEND_URL บน Vercel
  // ให้ชี้ไป backend จริง (เช่น https://xxx.up.railway.app) และเปลี่ยน
  // NEXT_PUBLIC_API_URL เป็น /api (relative) แทนการชี้ไป backend URL ตรงๆ
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
}

export default nextConfig
