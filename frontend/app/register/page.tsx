//app/register/page.tsx

"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
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
import { Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/language-context";

// ตรวจรูปแบบอีเมลแบบเข้มขึ้น (ต้องมี @ และโดเมนที่มีจุด)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ตรวจรูปแบบเบอร์โทรไทย: รับทั้งแบบมีขีดหรือไม่มีขีด เช่น 081-234-5678 หรือ 0812345678
// อนุญาตเลข 9-10 หลัก ขึ้นต้นด้วย 0
function isValidThaiPhone(phone: string) {
  const digitsOnly = phone.replace(/[-\s]/g, "");
  return /^0\d{8,9}$/.test(digitsOnly);
}

// ⚠️ ใหม่: self-register เปลี่ยนจากฟอร์มเดียวจบเป็น 3 ขั้นตอน — ต้องยืนยัน
// ความเป็นเจ้าของอีเมลด้วยรหัส OTP ให้เสร็จก่อน ถึงจะไปกรอกเบอร์/ตั้งรหัสผ่าน
// ได้ (อีเมลเลยกลายเป็นบังคับกรอกสำหรับ flow นี้ ต่างจากแอดมินเพิ่มผู้เช่าเอง
// ที่ยังปล่อยอีเมล optional เหมือนเดิม)
type Step = "email" | "otp" | "details";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [ticket, setTicket] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ── ขั้นที่ 1: กรอกอีเมล → ขอรหัส OTP ──
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError(t("register.errorRequiredEmail"));
      return;
    }
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setError(t("register.errorInvalidEmail"));
      return;
    }

    setIsLoading(true);
    try {
      await authAPI.requestRegistrationOtp(cleanEmail);
      setEmail(cleanEmail);
      setStep("otp");
    } catch (err: any) {
      setError(err?.response?.data?.message || t("common.error"));
    }
    setIsLoading(false);
  };

  // ── ขั้นที่ 2: กรอกรหัส OTP → ยืนยัน ได้ ticket กลับมา ──
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setError(t("register.errorOtpLength"));
      return;
    }

    setIsLoading(true);
    try {
      const res = await authAPI.verifyRegistrationOtp(email, cleanOtp);
      setTicket(res.data.ticket);
      setStep("details");
    } catch (err: any) {
      setError(err?.response?.data?.message || t("common.error"));
    }
    setIsLoading(false);
  };

  const handleResendOtp = async () => {
    setError("");
    setIsLoading(true);
    try {
      await authAPI.requestRegistrationOtp(email);
      setOtp("");
    } catch (err: any) {
      setError(err?.response?.data?.message || t("common.error"));
    }
    setIsLoading(false);
  };

  // ── ขั้นที่ 3: กรอกชื่อ/เบอร์/รหัสผ่าน + แนบ ticket → สมัครจริง ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (
      !formData.name.trim() ||
      !formData.phone.trim() ||
      !formData.password.trim() ||
      !formData.confirmPassword.trim()
    ) {
      setError(t("common.requiredFields") || "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    const cleanPassword = formData.password.trim();
    const cleanConfirmPassword = formData.confirmPassword.trim();
    const cleanPhone = formData.phone.trim();
    const cleanName = formData.name.trim();

    if (cleanName.length < 2) {
      setError(t("register.errorNameLength"));
      return;
    }
    if (!isValidThaiPhone(cleanPhone)) {
      setError(t("register.errorInvalidPhone"));
      return;
    }
    if (cleanPassword !== cleanConfirmPassword) {
      setError(t("register.errorPasswordMismatch"));
      return;
    }
    if (cleanPassword.length < 6) {
      setError(t("register.errorPasswordLength"));
      return;
    }

    setIsLoading(true);

    const result = await register({
      password: cleanPassword,
      name: cleanName,
      phone: cleanPhone,
      ticket,
    });

    if (result.success) {
      router.push("/tenant");
    } else {
      if (result.error === "ERROR_DUPLICATE_ENTRY") {
        setError(t("register.errorDuplicate"));
      } else {
        setError(result.error || t("common.error"));
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setLanguage(language === "th" ? "en" : "th")}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
            >
              {language === "th" ? "EN" : "TH"}
            </button>
          </div>
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {step === "email" && t("register.stepEmailTitle")}
            {step === "otp" && t("register.stepOtpTitle")}
            {step === "details" && t("register.title")}
          </CardTitle>
          <CardDescription>
            {step === "email" && t("register.stepEmailDesc")}
            {step === "otp" && t("register.stepOtpDesc", { email })}
            {step === "details" && t("register.stepDetailsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <form onSubmit={handleRequestOtp} noValidate>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">{t("common.email")}</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("register.emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoFocus
                  />
                </Field>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("register.sendingCode")}
                    </>
                  ) : (
                    t("register.sendCode")
                  )}
                </Button>
              </FieldGroup>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} noValidate>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="otp">
                    {t("register.stepOtpTitle")}
                  </FieldLabel>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t("register.otpPlaceholder")}
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    required
                    disabled={isLoading}
                    autoFocus
                    className="text-center text-lg tracking-[0.5em]"
                  />
                </Field>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("register.verifyingCode")}
                    </>
                  ) : (
                    t("register.verifyCode")
                  )}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setOtp("");
                      setError("");
                    }}
                    disabled={isLoading}
                    className="text-muted-foreground hover:underline"
                  >
                    {t("register.changeEmail")}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isLoading}
                    className="text-primary hover:underline"
                  >
                    {t("register.resendCode")}
                  </button>
                </div>
              </FieldGroup>
            </form>
          )}

          {step === "details" && (
            <>
              <form onSubmit={handleSubmit} noValidate>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="name">
                      {t("register.fullName")}
                    </FieldLabel>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder={t("register.fullNamePlaceholder")}
                      value={formData.name}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      autoFocus
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="phone">
                      {t("common.phone")}
                    </FieldLabel>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder={t("register.phonePlaceholder")}
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      maxLength={10}
                      inputMode="numeric"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">
                      {t("common.password")}
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        disabled={isLoading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirmPassword">
                      {t("register.confirmPassword")}
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                        disabled={isLoading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </Field>

                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("register.loading")}
                      </>
                    ) : (
                      t("register.submit")
                    )}
                  </Button>
                </FieldGroup>
              </form>
            </>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {t("register.hasAccount")}{" "}
            <Link href="/login" className="text-primary hover:underline">
              {t("register.login")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
