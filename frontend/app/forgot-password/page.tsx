//app/forgot-password/page.tsx

"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { authAPI } from "@/lib/api/auth.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/language-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import {
  Building2,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

export default function ForgotPasswordPage() {
  const { t } = useLanguage(); // ← ต้องอยู่ใน component

  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await authAPI.forgotPassword(username.trim());
      setStatus("success");
      setMessage(res.message || t("common.success"));
    } catch (err: unknown) {
      setStatus("error");
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || t("common.error");
      setMessage(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {t("forgotPassword.title")}
          </CardTitle>
          <CardDescription>{t("forgotPassword.subtitle")}</CardDescription>
        </CardHeader>

        <CardContent>
          {status === "success" ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="p-3 rounded-full bg-success/20">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {message}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("forgotPassword.linkExpiry")}{" "}
                  <span className="font-medium text-foreground">
                    15 {t("forgotPassword.minutes")}
                  </span>
                </p>
              </div>
              <Button asChild className="w-full" variant="outline">
                <Link href="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("forgotPassword.backToLogin")}
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                {/* ⚠️ FIX: เดิมใช้ t("forgotPassword.usernameLabel") /
                    usernamePlaceholder ซึ่งน่าจะแปลไว้ว่า "Username" เฉยๆ
                    ทำให้ผู้ใช้งง ทั้งที่ backend (findByIdentifier) รับได้
                    ทั้งเบอร์โทรและอีเมลอยู่แล้ว — เปลี่ยนมาใช้ key เดียวกับ
                    หน้า login ("เบอร์โทรศัพท์หรืออีเมล") เพื่อความชัดเจนที่
                    ตรงกับพฤติกรรมจริงของ field นี้ และตรงกับหน้า login ด้วย */}
                <Field>
                  <FieldLabel htmlFor="username">
                    {t("login.phoneOrEmail")}
                  </FieldLabel>
                  <Input
                    id="username"
                    type="text"
                    autoComplete="email"
                    placeholder={t("login.phoneOrEmailPlaceholder")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={status === "loading"}
                    autoFocus
                  />
                </Field>

                {status === "error" && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{message}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={status === "loading" || !username.trim()}
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("common.sending")}
                    </>
                  ) : (
                    t("forgotPassword.submit")
                  )}
                </Button>
              </FieldGroup>
            </form>
          )}

          {status !== "success" && (
            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                {t("forgotPassword.backToLogin")}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
