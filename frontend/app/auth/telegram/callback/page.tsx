//app/auth/telegram/callback/page.tsx

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Building2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import api from "@/lib/api/axiosInstance";
import { useAuth } from "@/context/auth-context";

/**
 * /auth/telegram/callback?code=<short-lived exchange code>
 *
 * ⚠️ SECURITY FIX (เหมือนกับ /auth/google/callback):
 * เดิมหน้านี้รับ JWT เต็มๆ ตรงๆ จาก query param (?token=...) แล้วเก็บลง
 * localStorage ทันที — เปลี่ยนมารับแค่ opaque exchange code แบบสุ่ม
 * ใช้ได้ครั้งเดียว อายุ 60 วิ แล้วยิง POST /api/auth/oauth/exchange
 * ทันทีเพื่อแลกเป็น session จริง backend จะ set httpOnly cookie ให้เอง
 * ผ่าน response header (ไม่ผ่าน URL อีกเลย) frontend ไม่ต้องแตะ token
 * โดยตรงอีกต่อไป — ใช้แค่ `user.role` จาก response เพื่อ redirect เท่านั้น
 */
function TelegramCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasExchangedRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const err = searchParams.get("error");

    if (err) {
      setError(decodeURIComponent(err));
      return;
    }

    if (!code) {
      setError("ไม่ได้รับ code จาก Telegram");
      return;
    }

    // ⚠️ FIX: เดิมไม่มี guard กันตรงนี้ (มีใน Google callback แต่ไม่มีที่นี่)
    // — code แลกได้ครั้งเดียว ถ้า effect ยิงซ้ำ (เช่น React StrictMode หรือ
    // dependency เปลี่ยน) ครั้งแรกแลก session สำเร็จจริงฝั่ง server แต่
    // ครั้งที่สองยิงซ้ำด้วย code เดิมที่ถูกใช้ไปแล้ว จะโดน backend ปฏิเสธ
    // แล้วโชว์ error ทับหน้าจอ ทั้งที่ login สำเร็จจริงไปแล้วรอบแรก
    if (hasExchangedRef.current) return;
    hasExchangedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const res = await api.post("/auth/oauth/exchange", { code });
        const { user } = res.data?.data ?? {};

        if (cancelled) return;

        if (!user) {
          setError("แลก session ไม่สำเร็จ กรุณาลองเข้าสู่ระบบใหม่");
          return;
        }

        // ⚠️ สำคัญ: เหมือน Google callback — ต้อง refreshUser() ก่อน
        // redirect เสมอ ไม่งั้น AuthProvider จะยังเห็น user เป็น null
        await refreshUser();
        router.replace(user.role === "admin" ? "/admin" : "/tenant");
      } catch (e: any) {
        if (cancelled) return;
        setError(
          e?.response?.data?.message ??
            "Code ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="p-3 rounded-full bg-destructive/10">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <p className="font-medium">เข้าสู่ระบบด้วย Telegram ไม่สำเร็จ</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">กลับไปหน้าเข้าสู่ระบบ</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        กำลังเข้าสู่ระบบด้วย Telegram...
      </p>
    </div>
  );
}

export default function TelegramCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-xl">SDMS</CardTitle>
          <CardDescription>เข้าสู่ระบบด้วย Telegram</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <TelegramCallbackInner />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
