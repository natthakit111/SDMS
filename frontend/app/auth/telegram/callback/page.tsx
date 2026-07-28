"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
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

/**
 * /auth/telegram/callback?token=<JWT>
 *
 * Backend (passport-telegram) redirects here after user authorizes via Telegram.
 * Same flow as Google callback — stores JWT and redirects by role.
 */
function TelegramCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const err = searchParams.get("error");

    if (err) {
      setError(decodeURIComponent(err));
      return;
    }

    if (!token) {
      setError("ไม่ได้รับ token จาก Telegram");
      return;
    }

    localStorage.setItem("token", token);

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const role: string = payload.role ?? "tenant";
      router.replace(role === "admin" ? "/admin" : "/tenant");
    } catch {
      router.replace("/tenant");
    }
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
