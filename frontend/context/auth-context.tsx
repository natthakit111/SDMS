//context/auth-context.tsx

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api/axiosInstance";
import { useLanguage } from "@/context/language-context";
import { getErrorMessage } from "@/lib/errorMessages";

export type UserRole = "admin" | "tenant";

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  email?: string;
  roomNumber?: string;
  phone?: string;
  telegramId?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (
    username: string,
    password: string,
    rememberMe: boolean,
  ) => Promise<{ success: boolean; error?: string; user?: User }>;
  register: (
    data: RegisterData,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  // ⚠️ ใหม่: ให้หน้า OAuth callback (Google/Telegram) เรียกหลัง exchange
  // code สำเร็จ เพื่อ sync `user` state เข้า context — จำเป็นเพราะหน้า
  // callback เรียก exchange ผ่าน axios ตรงๆ ไม่ผ่าน context เลย และ
  // AuthProvider ไม่ได้ remount ใหม่ตอน router.replace() (Next.js App
  // Router คง provider เดิมไว้ทั้งแอป) ถ้าไม่เรียกตัวนี้ `user` จะค้าง
  // เป็น null ต่อไป ทำให้ route guard ของหน้า /admin, /tenant เข้าใจผิด
  // ว่ายังไม่ login แล้วเด้งกลับ /login ทันที
  refreshUser: () => Promise<User | null>;
}

interface RegisterData {
  password: string;
  name?: string;
  phone?: string;
  email?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapUser = (backendUser: any): User => ({
  id: String(backendUser.user_id),
  username: backendUser.username,
  name:
    `${backendUser.first_name || ""} ${backendUser.last_name || ""}`.trim() ||
    backendUser.username,
  role: backendUser.role,
  email: backendUser.email,
  phone: backendUser.phone,
  roomNumber: backendUser.room_number,
  telegramId: backendUser.telegram_chat_id,
});

// ⚠️ SECURITY MIGRATION (localStorage → httpOnly cookie):
// เดิม auth-context เช็ค localStorage.getItem("token") เพื่อรู้ว่ามี
// session อยู่ไหม (ทั้งตอน init และก่อนยิง /auth/me) — ตอนนี้ token จริง
// อยู่ใน httpOnly cookie ที่ JS อ่านไม่ได้แล้ว จึงใช้ `auth_hint` cookie
// (ไม่มีข้อมูลอ่อนไหว แค่บอกว่า "น่าจะมี session") เป็นตัวเช็คแทน เพื่อ
// เลี่ยงการยิง /auth/me โดยไม่จำเป็นตอนเป็น anonymous visitor เฉยๆ
// (เช่น คนที่ยังไม่เคย login เลยเข้าหน้า /login) — เป็นแค่ optimization
// ไม่ใช่กลไกความปลอดภัย เพราะต่อให้เดา/ปลอมคุกกี้นี้ได้ ก็ยังต้องผ่าน
// jwt.verify() ที่ auth.middleware.js ฝั่ง backend อยู่ดี
const hasSessionHint = () =>
  typeof document !== "undefined" && document.cookie.includes("auth_hint=1");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  // ⚠️ ใหม่: ใช้แปล error message จาก backend (code) ให้ตรงกับภาษาที่
  // ผู้ใช้เลือกไว้ ณ ขณะนั้น — ต้องให้ LanguageProvider ครอบ AuthProvider
  // อยู่ใน layout.tsx เท่านั้น ไม่งั้น useLanguage() จะหา context ไม่เจอ
  const { language } = useLanguage();

  // ดึงข้อมูล user ปัจจุบันจาก /auth/me แล้ว sync เข้า state — ใช้ทั้งตอน
  // init ครั้งแรก และตอน OAuth callback เรียกหลัง exchange สำเร็จ
  const refreshUser = async (): Promise<User | null> => {
    try {
      const res = await api.get("/auth/me");
      const backendUser = res.data.data ?? res.data.user ?? res.data;
      const mappedUser = mapUser(backendUser);
      setUser(mappedUser);
      return mappedUser;
    } catch {
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    const init = async () => {
      // ⚠️ เดิมมี logic parse ?token=... จาก URL ตรงนี้ (สำหรับ OAuth
      // callback) — ตัดออกทั้งหมดแล้ว เพราะตอนนี้หน้า
      // /auth/google/callback และ /auth/telegram/callback แลก code
      // เป็น session ของตัวเองโดยตรงผ่าน POST /auth/oauth/exchange
      // (ซึ่ง backend set httpOnly cookie ให้เรียบร้อยตั้งแต่ตอนนั้น)
      // แล้วเรียก refreshUser() ของตัวเองก่อน redirect ไป /admin หรือ
      // /tenant เลย ไม่ต้องพึ่ง auth-context ตรงนี้จัดการ token จาก URL
      // อีกต่อไป
      if (!hasSessionHint()) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      await refreshUser();
      setIsLoading(false);
    };

    init();
  }, []);

  const login = async (
    username: string,
    password: string,
    rememberMe: boolean,
  ) => {
    try {
      const res = await api.post("/auth/login", {
        username,
        password,
        rememberMe,
      });

      // ⚠️ เดิมอ่าน payload.token แล้วเก็บ localStorage เอง — ตัดออกแล้ว
      // backend set httpOnly cookie ให้เองผ่าน response header (Set-Cookie)
      // ของ request นี้โดยตรง ไม่ต้องทำอะไรกับ token ฝั่ง client เลย
      const backendUser = res.data.data?.user;

      if (!backendUser) {
        return {
          success: false,
          error:
            language === "th"
              ? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่"
              : "Login failed, please try again",
        };
      }

      const mappedUser = mapUser(backendUser);
      setUser(mappedUser);
      return { success: true, user: mappedUser };
    } catch (err: any) {
      // ⚠️ ใหม่: ใช้ getErrorMessage แทนการอ่าน err.response.data.message
      // ตรงๆ — ถ้า backend ส่ง `code` มาด้วย (เช่น AUTH_INVALID_PASSWORD)
      // จะแปลตามภาษาที่เลือกได้ ถ้ายังไม่มี code (controller เก่าที่ยัง
      // ไม่ได้แก้) จะ fallback ไปใช้ message ภาษาไทยจาก backend เหมือนเดิม
      return { success: false, error: getErrorMessage(err, language) };
    }
  };

  const register = async (data: RegisterData) => {
    try {
      await api.post("/auth/register", {
        password: data.password,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: "tenant",
      });
      // สมัครสำเร็จแล้ว แต่ backend ไม่ set session ให้อัตโนมัติ — ต้อง login
      // ต่อทันทีด้วย username ที่ backend สร้างให้ (= เบอร์โทร) ไม่งั้นหน้า
      // /tenant ที่ redirect ไปจะเช็คแล้วไม่พบ session แล้วเด้งกลับ /login
      return await login(data.phone ?? "", data.password, false);
    } catch (err: any) {
      return { success: false, error: getErrorMessage(err, language) };
    }
  };

  // ⚠️ เดิม logout() เป็น sync — แค่ localStorage.removeItem แล้วจบ
  // ตอนนี้ต้องเป็น async และเรียก backend เสมอ เพราะ cookie `token` เป็น
  // httpOnly ลบเองจาก JS ไม่ได้อีกต่อไป ต้องให้ backend สั่ง clearCookie
  // ให้เท่านั้น (ดู POST /auth/logout ใน auth.routes.js)
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ต่อให้ request ล้มเหลว (เช่น เน็ตหลุด) ก็ยัง clear state ฝั่ง
      // client ต่อไปตามปกติ — cookie อาจค้างอยู่ฝั่ง browser แต่ไม่กระทบ
      // ผู้ใช้เพราะ UI แสดงว่า logout แล้ว และ token จะหมดอายุเองตามเวลา
    } finally {
      setUser(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
