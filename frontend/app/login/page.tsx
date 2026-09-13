// app/login/page.tsx

"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { authAPI } from "@/lib/api/auth.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Building2, Eye, EyeOff, Loader2, Globe } from "lucide-react";

/* ── OAuth brand icons (inline SVG) ── */
const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";


function getSafeRedirect(raw: string | null): string | null {
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  // ต้องขึ้นต้นด้วย "/" ตัวเดียว และห้ามเป็น "//" หรือ "/\" ตามด้วยอะไรก็ตาม
  // (เบราว์เซอร์บางตัวมองว่าเป็น scheme-relative URL แล้ววิ่งออกโดเมนได้)
  if (!/^\/(?!\/|\\)/.test(decoded)) return null;
  return decoded;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent"
  >("idle");

  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");

  const handleResend = async () => {
    setResendStatus("sending");
    try {
      await authAPI.resendVerification(username);
    } finally {
      setResendStatus("sent");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setResendStatus("idle");
    setIsLoading(true);
    const result = await login(username, password, rememberMe);

    if (result.success && result.user) {
      // ใช้ redirect param เฉพาะเมื่อเป็น path ภายในระบบ "ของ role เดียวกัน"
      // กับ user ที่เพิ่ง login สำเร็จเท่านั้น ไม่งั้น fallback ไปตาม role
      // เหมือนเดิม — เดิมใช้ redirect param ตรงๆ โดยไม่เช็ค role เลย ทำให้
      // ถ้า logout จากหน้า /tenant/xxx แล้ว login ด้วยบัญชี admin จะโดนพา
      // กลับไป /tenant/xxx ต่อ (ผิด role) แล้ว route guard ของหน้านั้นเด้ง
      // กลับมา /login พร้อม redirect เดิมทันที ดูเหมือนกด login แล้วไม่ขยับ
      const roleHome = result.user.role === "admin" ? "/admin" : "/tenant";
      const safeRedirect = getSafeRedirect(redirectTo);
      if (safeRedirect && safeRedirect.startsWith(roleHome)) {
        router.push(safeRedirect);
      } else {
        router.push(roleHome);
      }
    } else {
      setError(result.error || t("common.error"));
      setNeedsVerification(result.code === "AUTH_EMAIL_NOT_VERIFIED");
      setPassword("");
    }
    setIsLoading(false);
  };

  const handleGoogleLogin = () => {
    setOauthLoading("google");
    window.location.href = `${BACKEND_URL}/auth/google`;
  };

  const isAnyLoading = isLoading || oauthLoading !== null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 p-3 rounded-full bg-accent/15">
            <Building2 className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground">SDMS</h1>
          <p className="text-sm text-primary-foreground/50 mt-1">
            {t("login.subtitle")}
          </p>
        </div>

      <Card className="w-full relative shadow-2xl">
        {/* Language Switcher */}
        <div className="absolute top-3 right-3">
          <div className="flex items-center rounded-full border bg-muted p-0.5">
            <button
              onClick={() => setLanguage("th")}
              className={`px-2 py-1 text-xs rounded-full transition ${
                language === "th"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              TH
            </button>
            <button
              onClick={() => setLanguage("en")}
              className={`px-2 py-1 text-xs rounded-full transition ${
                language === "en"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              EN
            </button>
          </div>
        </div>

        <CardContent className="space-y-4 pt-6">
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isAnyLoading}
            >
              {oauthLoading === "google" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              <span className="ml-2">Google</span>
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {t("login.orLoginWith")}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">
                  {t("login.phoneOrEmail")}
                </FieldLabel>
                <Input
                  id="username"
                  type="text"
                  placeholder={t("login.phoneOrEmailPlaceholder")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isAnyLoading}
                  className="bg-muted border-0 focus-visible:ring-accent/50"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">
                  {t("common.password")}
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isAnyLoading}
                    className="bg-muted border-0 focus-visible:ring-accent/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isAnyLoading}
                    className="accent-accent"
                  />
                  {t("login.rememberMe")}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-accent hover:underline"
                >
                  {t("login.forgotPassword")}
                </Link>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md space-y-2">
                  <p>{error}</p>
                  {needsVerification && (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendStatus !== "idle"}
                      className="text-accent hover:underline disabled:no-underline disabled:text-muted-foreground"
                    >
                      {resendStatus === "sent"
                        ? t("login.verificationResent")
                        : resendStatus === "sending"
                          ? t("login.resendingVerification")
                          : t("login.resendVerification")}
                    </button>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={isAnyLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("login.loggingIn")}
                  </>
                ) : (
                  t("login.submit")
                )}
              </Button>
            </FieldGroup>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {t("login.noAccount")}{" "}
            <Link href="/register" className="text-accent hover:underline">
              {t("login.register")}
            </Link>
          </p>
        </CardContent>
      </Card>

        <p className="mt-6 text-center text-xs text-primary-foreground/40">
          SDMS Web
        </p>
      </div>
    </div>
  );
}
