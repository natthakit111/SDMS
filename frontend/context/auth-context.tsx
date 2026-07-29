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
  logout: () => void;
}

// 💡 แก้ไขตรงนี้: ลบ username ออก เพราะหน้า register ไม่ได้ส่งมาแล้ว
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      // ── ตรวจ OAuth token จาก URL query param (?token=...) ──
      // Google/Telegram callback จะแนบ token มาใน URL
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");

        if (urlToken) {
          localStorage.setItem("token", urlToken);

          // ลบ token ออกจาก URL โดยไม่ reload
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, "", cleanUrl);
        }
      }

      // ── โหลด user จาก token ที่มีอยู่ (เดิม หรือจาก URL) ──
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const res = await api.get("/auth/me");
          const backendUser = res.data.data ?? res.data.user ?? res.data;
          const mappedUser = mapUser(backendUser);
          setUser(mappedUser);

          // ถ้าอยู่ที่หน้า callback ให้ redirect ไป dashboard เลย
          if (typeof window !== "undefined") {
            const path = window.location.pathname;
            if (
              path.includes("/auth/google/callback") ||
              path.includes("/auth/telegram/callback")
            ) {
              router.replace(
                mappedUser.role === "admin" ? "/admin" : "/tenant",
              );
            }
          }
        } catch {
          localStorage.removeItem("token");
          setUser(null);
        }
      }

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

      const payload = res.data.data;
      const token = payload?.token;
      const backendUser = payload?.user;

      if (!token) {
        return { success: false, error: "ไม่ได้รับ token จาก server" };
      }

      localStorage.setItem("token", token);

      let mappedUser: User;
      if (backendUser) {
        mappedUser = mapUser(backendUser);
      } else {
        const meRes = await api.get("/auth/me");
        const meUser = meRes.data.data ?? meRes.data.user ?? meRes.data;
        mappedUser = mapUser(meUser);
      }

      setUser(mappedUser);
      return { success: true, user: mappedUser };
    } catch (err: any) {
      const message =
        err.response?.data?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่";
      return { success: false, error: message };
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
      return { success: true };
    } catch (err: any) {
      const message =
        err.response?.data?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่";
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
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
