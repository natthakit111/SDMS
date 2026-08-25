//app/register/page.tsx

"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
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

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim() ||
      !formData.password.trim() ||
      !formData.confirmPassword.trim()
    ) {
      setError(t("common.requiredFields") || "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    const cleanEmail = formData.email.trim();
    const cleanPassword = formData.password.trim();
    const cleanConfirmPassword = formData.confirmPassword.trim();
    const cleanPhone = formData.phone.trim();
    const cleanName = formData.name.trim();

    // Validate ชื่อ (กันกรอกแค่ช่องว่างหรือสั้นเกินไป)
    if (cleanName.length < 2) {
      setError(t("register.errorNameLength"));
      return;
    }

    // Validate อีเมลแบบเข้มขึ้น
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setError(t("register.errorInvalidEmail"));
      return;
    }

    // Validate เบอร์โทร
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
      email: cleanEmail,
      phone: cleanPhone,
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
          <CardTitle className="text-2xl">{t("register.title")}</CardTitle>
          <CardDescription>{t("register.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">{t("register.fullName")}</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder={t("register.fullNamePlaceholder")}
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="email">{t("common.email")}</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={t("register.emailPlaceholder")}
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="phone">{t("common.phone")}</FieldLabel>
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
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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

              <Button type="submit" className="w-full" disabled={isLoading}>
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