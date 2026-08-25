//app/reset-password/page.tsx

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

const MIN_PASSWORD_LENGTH = 6;

const getStrength = (pw: string) => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
};

function ResetPasswordForm() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  // ⚠️ AUTH-12/13: เช็ค token ตั้งแต่โหลดหน้า ก่อนโชว์ฟอร์ม — เดิมเช็คแค่ว่า
  // URL มี token พารามิเตอร์ไหม โชว์ฟอร์มกรอกรหัสผ่านใหม่เต็มๆ ให้กรอกก่อน
  // ถึงจะไป error ตอนกด submit ทั้งที่ backend รู้อยู่แล้วว่า token
  // หมดอายุ/ถูกแทนที่ไปแล้วตั้งแต่แรก
  const [tokenCheck, setTokenCheck] = useState<
    "checking" | "valid" | "invalid"
  >("checking");
  const [tokenCheckMessage, setTokenCheckMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setTokenCheck("invalid");
      return;
    }
    authAPI
      .verifyResetToken(token)
      .then(() => setTokenCheck("valid"))
      .catch((err: unknown) => {
        setTokenCheck("invalid");
        const errorMessage = (
          err as { response?: { data?: { message?: string } } }
        )?.response?.data?.message;
        if (errorMessage) setTokenCheckMessage(errorMessage);
      });
  }, [token]);

  const strength = getStrength(newPassword);

  // ⚠️ FIX: เดิม index 0 ของ label array เป็น "" ทำให้พิมพ์รหัสผ่านสั้นๆ
  // (เช่น "a" ที่ยังไม่ผ่านเงื่อนไขไหนเลยใน getStrength) แล้วแถบไม่ติดสัก
  // ช่อง ข้อความ "ระดับความปลอดภัย:" โชว์ว่างเปล่า ดูเหมือนบั๊ก UI
  // แก้โดยให้ score 0 (มีตัวอักษรแล้วแต่ยังไม่เข้าเงื่อนไขใดๆ) ก็ยังขึ้น
  // label "อ่อนมาก" ได้ ไม่ใช่ค่าว่าง
  const strengthLabels = [
    t("password.veryWeak"), // score 0 — เดิมเป็น ""
    t("password.veryWeak"), // score 1
    t("password.weak"), // score 2
    t("password.medium"), // score 3
    t("password.strong"), // score 4
    t("password.veryStrong"), // score 5
  ];
  const strengthLabel = strengthLabels[strength];

  const strengthColors = [
    "bg-red-500", // score 0 — เดิมเป็น ""
    "bg-red-500", // score 1
    "bg-orange-400", // score 2
    "bg-yellow-400", // score 3
    "bg-blue-500", // score 4
    "bg-green-500", // score 5
  ];
  const strengthColor = strengthColors[strength];

  if (tokenCheck === "checking") {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tokenCheck === "invalid") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="p-3 rounded-full bg-destructive/10">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <p className="font-medium">{t("resetPassword.invalidLink")}</p>
        <p className="text-sm text-muted-foreground">
          {tokenCheckMessage || t("resetPassword.invalidLinkDesc")}
        </p>
        <Button asChild className="mt-2 w-full">
          <Link href="/forgot-password">{t("resetPassword.requestNew")}</Link>
        </Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setStatus("error");
      setMessage(t("password.noMatch"));
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setStatus("error");
      setMessage(t("password.minLength"));
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await authAPI.resetPassword(token, newPassword);
      setStatus("success");
      setMessage(res.message || t("resetPassword.success"));

      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch (err: unknown) {
      setStatus("error");
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || t("common.error");
      setMessage(errorMessage);
    }
  };

  if (status === "success") {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="p-3 rounded-full bg-success/20">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <p className="font-medium">{t("resetPassword.success")}</p>
          <p className="text-sm text-muted-foreground">
            {t("resetPassword.redirecting")}
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">{t("resetPassword.loginNow")}</Link>
        </Button>
      </div>
    );
  }

  // ⚠️ FIX: เดิมปุ่ม submit ไม่เช็คความยาวขั้นต่ำ — พิมพ์รหัสผ่านสั้นๆ
  // (เช่น "123") ที่ตรงกันทั้ง 2 ช่องแล้วปุ่มกดได้ ต้องรอ error กลับมา
  // จาก handleSubmit ทีหลัง เสีย round-trip ไปเปล่าๆ เพิ่มเช็ค length
  // เข้าไปใน disabled ด้วยเลย ปุ่มจะ disable ทันทีตั้งแต่ยังพิมพ์ไม่ครบ
  const isTooShort =
    newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="new-password">
            {t("resetPassword.newPassword")}
          </FieldLabel>
          <div className="relative">
            <Input
              id="new-password"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              required
              disabled={status === "loading"}
              className="pr-10"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showNew ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {newPassword && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      i <= strength ? strengthColor : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("password.strength")}:{" "}
                <span className="font-medium text-foreground">
                  {strengthLabel}
                </span>
              </p>
              {isTooShort && (
                <p className="text-xs text-destructive">
                  {t("password.minLength")}
                </p>
              )}
            </div>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm-password">
            {t("resetPassword.confirmPassword")}
          </FieldLabel>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              required
              disabled={status === "loading"}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {confirmPassword && (
            <p
              className={`text-xs mt-1 ${
                newPassword === confirmPassword
                  ? "text-green-600 dark:text-green-400"
                  : "text-destructive"
              }`}
            >
              {newPassword === confirmPassword
                ? `✓ ${t("password.match")}`
                : `✗ ${t("password.noMatch")}`}
            </p>
          )}
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
          disabled={
            status === "loading" ||
            !newPassword ||
            !confirmPassword ||
            newPassword !== confirmPassword ||
            isTooShort
          }
        >
          {status === "loading" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("common.saving")}
            </>
          ) : (
            t("resetPassword.submit")
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">{t("resetPassword.title")}</CardTitle>
          <CardDescription>{t("resetPassword.subtitle")}</CardDescription>
        </CardHeader>

        <CardContent>
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}