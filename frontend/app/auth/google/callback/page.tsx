//frontend/app/auth/google/callback/page.tsx

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
import { useLanguage } from "@/context/language-context"
/**
 * /auth/google/callback?code=<short-lived exchange code>
 *
 * ⚠️ SECURITY FIX:
 * เดิมหน้านี้รับ JWT เต็มๆ ตรงๆ จาก query param (?token=...) แล้วเก็บลง
 * localStorage ทันที ปัญหาคือ JWT (session token อายุ 1 วัน) ที่ฝังใน URL
 * ติดอยู่ใน browser history / server log / Referer header ได้ตั้งแต่ตอน
 * ที่ backend redirect มาแล้ว — ต่อให้ frontend ลบออกจาก address bar
 * ทีหลังก็สายเกินไป
 *
 * เปลี่ยนเป็นรับแค่ "exchange code" แบบสุ่ม ใช้ได้ครั้งเดียว อายุ 60 วิ
 * แล้วยิง POST /api/auth/oauth/exchange ทันทีเพื่อแลกเป็น JWT จริง
 * (ได้ JWT กลับทาง JSON response body เท่านั้น ไม่ผ่าน URL อีกเลย)
 * ต่อให้ code หลุดไปอยู่ใน log ก็ใช้ประโยชน์แทบไม่ได้ เพราะใช้ซ้ำไม่ได้
 * และหมดอายุเร็วมาก
 */
function GoogleCallbackInner() {
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
      setError("ไม่ได้รับ code จาก Google");
      return;
    }

    if (hasExchangedRef.current) return; // ← กันยิงซ้ำตรงนี้
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
          <p className="font-medium">เข้าสู่ระบบด้วย Google ไม่สำเร็จ</p>
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
        กำลังเข้าสู่ระบบด้วย Google...
      </p>
    </div>
  );
}

export default function GoogleCallbackPage() {
  const { language } = useLanguage();
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
          <CardDescription>
            {language === "th"
              ? "เข้าสู่ระบบด้วย Google"
              : "Sign in with Google"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <GoogleCallbackInner />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
