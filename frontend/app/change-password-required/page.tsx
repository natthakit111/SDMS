//app/change-password-required/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
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
  ShieldAlert,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

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

export default function ChangePasswordRequiredPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // ไม่ได้ login เลย → เด้งไป login, login แล้วแต่ไม่ต้องเปลี่ยนรหัสผ่าน →
  // เด้งไป dashboard ตาม role กันคนพิมพ์ URL นี้ตรงๆ ทั้งที่ไม่เข้าเงื่อนไข
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (!user.passwordMustChange) {
      router.replace(user.role === "admin" ? "/admin" : "/tenant");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || !user.passwordMustChange) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const strength = getStrength(newPassword);
  const strengthLabels = [
    t("password.veryWeak"),
    t("password.veryWeak"),
    t("password.weak"),
    t("password.medium"),
    t("password.strong"),
    t("password.veryStrong"),
  ];
  const strengthColors = [
    "bg-red-500",
    "bg-red-500",
    "bg-orange-400",
    "bg-yellow-400",
    "bg-blue-500",
    "bg-green-500",
  ];
  const isTooShort =
    newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError(t("password.noMatch"));
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t("password.minLength"));
      return;
    }

    setSubmitting(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setSuccess(true);
      await refreshUser();
      setTimeout(() => {
        router.push(user.role === "admin" ? "/admin" : "/tenant");
      }, 1200);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || t("common.error");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-warning/10">
              <ShieldAlert className="h-8 w-8 text-warning" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {t("forcePasswordChange.title")}
          </CardTitle>
          <CardDescription>
            {t("forcePasswordChange.subtitle")}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="p-3 rounded-full bg-success/20">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <p className="font-medium">
                {t("forcePasswordChange.success")}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="current-password">
                    {t("forcePasswordChange.currentPassword")}
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrent ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      disabled={submitting}
                      className="pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showCurrent ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Field>

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
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={submitting}
                      className="pr-10"
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
                              i <= strength
                                ? strengthColors[strength]
                                : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("password.strength")}:{" "}
                        <span className="font-medium text-foreground">
                          {strengthLabels[strength]}
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
                  <Input
                    id="confirm-password"
                    type={showNew ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={submitting}
                  />
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

                {error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    submitting ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword ||
                    newPassword !== confirmPassword ||
                    isTooShort
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("common.saving")}
                    </>
                  ) : (
                    t("forcePasswordChange.submit")
                  )}
                </Button>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
