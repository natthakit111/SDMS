//app/tenant/profile/page.tsx

"use client";

export const dynamic = "force-dynamic";

import { Switch } from "@/components/ui/switch";
import { notificationPreferenceAPI } from "@/lib/api/notificationPreference.api";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { authAPI } from "@/lib/api/auth.api";
import api from "@/lib/api/axiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  Pencil,
  Send,
  LinkIcon,
  Unlink,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/language-context";

const telegramAPI = {
  getStatus: () => api.get("/telegram/status"),
  generateLink: () => api.post("/telegram/generate-link"),
  unlink: () => api.delete("/telegram/unlink"),
};

// Simple, reasonably permissive email check for client-side UX.
// Backend must still be the source of truth for validation.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Accepts Thai mobile formats like 08x-xxx-xxxx, 0xxxxxxxxx, +66xxxxxxxxx
const PHONE_REGEX = /^(\+66|0)\d{9,10}$/;

const OAUTH_PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  telegram: "Telegram",
  facebook: "Facebook",
  line: "Line",
};

export default function TenantProfilePage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const hasPassword = !!(user as any)?.has_password;
  const oauthProvider = (user as any)?.oauth_provider ?? null;
  const oauthProviderLabel = oauthProvider
    ? (OAUTH_PROVIDER_LABELS[oauthProvider] ?? oauthProvider)
    : null;

  /* ── Profile state ── */
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileErrors, setProfileErrors] = useState<{
    firstName?: string;
    email?: string;
    phone?: string;
  }>({});

  /* ── Password state ── */
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  /* ── Telegram state ── */
  const [tgLinked, setTgLinked] = useState(false);
  const [tgChatId, setTgChatId] = useState<string | null>(null);
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(null);
  const [tgLinkLoading, setTgLinkLoading] = useState(false);
  const [tgPolling, setTgPolling] = useState(false);
  const [tgUnlinkLoading, setTgUnlinkLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);

  type NotifyPrefs = {
    notify_bill: boolean;
    notify_overdue: boolean;
    notify_maintenance: boolean;
    notify_announcement: boolean;
  };
  const [prefs, setPrefs] = useState<NotifyPrefs>({
    notify_bill: true,
    notify_overdue: true,
    notify_maintenance: true,
    notify_announcement: true,
  });

  /* ── Init ── */
  useEffect(() => {
    if (!user) return;
    const nameParts = (user.name || "").split(" ");
    setProfile({
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(1).join(" ") || "",
      email: user.email || "",
      phone: user.phone || "",
    });
    telegramAPI
      .getStatus()
      .then((r) => {
        setTgLinked(r.data?.data?.linked ?? false);
        setTgChatId(r.data?.data?.chat_id ?? null);
      })
      .catch(() => {});
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [user]);

  useEffect(() => {
    if (!tgLinked) return;
    notificationPreferenceAPI
      .get()
      .then((r) => {
        const d = r.data?.data;
        if (d) {
          setPrefs((p) => ({
            notify_bill: d.notify_bill !== 0,
            notify_overdue: d.notify_overdue !== 0,
            notify_maintenance: d.notify_maintenance !== 0,
            notify_announcement: d.notify_announcement !== 0,
          }));
        }
      })
      .catch(() => {});
  }, [tgLinked]);

  /* ── Password strength ── */
  const getStrength = (pw: string) => {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 6) s++;
    if (pw.length >= 10) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };
  const strength = getStrength(passwords.newPassword);
  const strengthColor = [
    "",
    "bg-red-500",
    "bg-orange-400",
    "bg-yellow-400",
    "bg-blue-500",
    "bg-green-500",
  ][strength];
  const strengthLabel = [
    "",
    language === "th" ? "อ่อนมาก" : "Very Weak",
    language === "th" ? "อ่อน" : "Weak",
    language === "th" ? "ปานกลาง" : "Fair",
    language === "th" ? "แข็งแรง" : "Strong",
    language === "th" ? "แข็งแรงมาก" : "Very Strong",
  ][strength];

  // Minimum bar we actually enforce: at least 6 chars AND
  // (at least one letter AND one number), matching what the
  // strength meter visually promises instead of silently allowing "123456".
  const isPasswordStrongEnough = (pw: string) =>
    pw.length >= 6 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);

  /* ── Profile validation ── */
  const validateProfile = () => {
    const errors: typeof profileErrors = {};
    if (!profile.firstName.trim()) {
      errors.firstName =
        language === "th" ? "กรุณากรอกชื่อจริง" : "First name is required";
    }
    if (profile.email && !EMAIL_REGEX.test(profile.email.trim())) {
      errors.email =
        language === "th" ? "รูปแบบอีเมลไม่ถูกต้อง" : "Invalid email format";
    }
    if (profile.phone && !PHONE_REGEX.test(profile.phone.trim())) {
      errors.phone =
        language === "th"
          ? "รูปแบบเบอร์โทรไม่ถูกต้อง (เช่น 0812345678)"
          : "Invalid phone number format (e.g. 0812345678)";
    }
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ── Submit profile ── */
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(false);
    if (!validateProfile()) return;
    setProfileLoading(true);
    try {
      await authAPI.updateProfile({
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim(),
      });
      setProfileSuccess(true);
      toast.success(
        language === "th" ? "บันทึกข้อมูลสำเร็จ" : "Profile saved successfully",
      );
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ??
          (language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred"),
      );
    } finally {
      setProfileLoading(false);
    }
  };

  /* ── Set password — OAuth user ครั้งแรก (ไม่ต้องใส่รหัสเดิม) ── */
  const handleSetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError(
        language === "th"
          ? "รหัสผ่านทั้งสองช่องไม่ตรงกัน"
          : "Passwords do not match",
      );
      return;
    }
    if (!isPasswordStrongEnough(passwords.newPassword)) {
      setPasswordError(
        language === "th"
          ? "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร และมีทั้งตัวอักษรและตัวเลข"
          : "Password must be at least 6 characters and include both letters and numbers",
      );
      return;
    }
    setPasswordLoading(true);
    try {
      await (authAPI as any).setPassword(passwords.newPassword);
      setPasswordSuccess(true);
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success(
        language === "th"
          ? "ตั้งรหัสผ่านสำเร็จ! ตอนนี้คุณสามารถ login ด้วย username ได้แล้ว"
          : "Password set! You can now login with your username.",
      );
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(
        err.response?.data?.message ??
          (language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred"),
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  /* ── Change password — user ปกติ ── */
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError(
        language === "th"
          ? "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน"
          : "New passwords do not match",
      );
      return;
    }
    if (!isPasswordStrongEnough(passwords.newPassword)) {
      setPasswordError(
        language === "th"
          ? "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร และมีทั้งตัวอักษรและตัวเลข"
          : "New password must be at least 6 characters and include both letters and numbers",
      );
      return;
    }
    if (
      passwords.currentPassword &&
      passwords.newPassword === passwords.currentPassword
    ) {
      setPasswordError(
        language === "th"
          ? "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม"
          : "New password must be different from the current password",
      );
      return;
    }
    setPasswordLoading(true);
    try {
      await authAPI.changePassword(
        passwords.currentPassword,
        passwords.newPassword,
      );
      setPasswordSuccess(true);
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success(
        language === "th"
          ? "เปลี่ยนรหัสผ่านสำเร็จ"
          : "Password changed successfully",
      );
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(
        err.response?.data?.message ??
          (language === "th"
            ? "รหัสผ่านปัจจุบันไม่ถูกต้อง"
            : "Current password is incorrect"),
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  /* ── Telegram ── */
  const handleGenerateLink = async () => {
    // Prevent stacking multiple intervals if the user clicks "refresh"
    // while a previous polling loop is still running.
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setTgPolling(false);

    setTgLinkLoading(true);
    try {
      const res = await telegramAPI.generateLink();
      const link = res.data?.data?.deepLink;
      setTgDeepLink(link);
      setTgPolling(true);
      let attempts = 0;
      pollingRef.current = setInterval(async () => {
        attempts++;
        try {
          const r = await telegramAPI.getStatus();
          if (r.data?.data?.linked) {
            setTgLinked(true);
            setTgChatId(r.data?.data?.chat_id);
            setTgDeepLink(null);
            setTgPolling(false);
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            toast.success(
              language === "th"
                ? "เชื่อมต่อ Telegram สำเร็จ! 🎉"
                : "Telegram connected successfully! 🎉",
            );
          }
        } catch {}
        if (attempts >= 200) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setTgPolling(false);
        }
      }, 3000);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ??
          (language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred"),
      );
    } finally {
      setTgLinkLoading(false);
    }
  };

  const handleUnlink = async () => {
    setTgUnlinkLoading(true);
    try {
      await telegramAPI.unlink();
      setTgLinked(false);
      setTgChatId(null);
      setTgDeepLink(null);
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
      setTgPolling(false);
      toast.success(
        language === "th"
          ? "ยกเลิกการเชื่อมต่อ Telegram แล้ว"
          : "Telegram disconnected",
      );
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ??
          (language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred"),
      );
    } finally {
      setTgUnlinkLoading(false);
    }
  };

  const handleTogglePref = async (key: keyof NotifyPrefs, value: boolean) => {
    const prev = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value })); // optimistic update
    setPrefsLoading(true);
    try {
      await notificationPreferenceAPI.update({ [key]: value });
    } catch {
      setPrefs((p) => ({ ...p, [key]: prev })); // rollback ถ้าบันทึกล้มเหลว
      toast.error(
        language === "th"
          ? "บันทึกการตั้งค่าไม่สำเร็จ"
          : "Failed to save setting",
      );
    } finally {
      setPrefsLoading(false);
    }
  };

  // Steps shown while waiting for the Telegram deep link to be confirmed.
  const telegramConnectSteps =
    language === "th"
      ? [
          'กดปุ่ม "เปิด Telegram" ด้านล่าง',
          "กด Start หรือ เริ่ม ใน Telegram",
          "กลับมาหน้านี้ — ระบบจะเชื่อมต่อให้อัตโนมัติ",
        ]
      : [
          'Tap "Open Telegram" below',
          "Tap Start in Telegram",
          "Return here — the system will connect automatically",
        ];

  // Benefits list shown before the user has linked Telegram.
  const telegramBenefits =
    language === "th"
      ? [
          "📄 บิลค่าเช่าใหม่",
          "✅ ยืนยันการชำระเงิน",
          "🔧 อัปเดตการแจ้งซ่อม",
          "📢 ประกาศจากหอพัก",
        ]
      : [
          "📄 New bills",
          "✅ Payment confirmed",
          "🔧 Maintenance updates",
          "📢 Announcements",
        ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("tenant.profile.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("tenant.profile.subtitle")}
        </p>
      </div>

      {/* Avatar card — อยู่นอก accordion เสมอ */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold select-none">
              {(user?.name || user?.username || "?")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold">
                {user?.name || user?.username}
              </p>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
              {user?.roomNumber && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full mt-1 inline-block">
                  {language === "th" ? "ห้อง" : "Room"} {user.roomNumber}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile form — อยู่นอก accordion เสมอ (ข้อมูลหลักที่เปิดดูบ่อยที่สุด) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Pencil className="h-5 w-5 text-primary" />
            {t("tenant.profile.personalInfo")}
          </CardTitle>
          <CardDescription>{t("tenant.profile.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} noValidate>
            <FieldGroup>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="firstName">
                    {t("common.firstName")}
                  </FieldLabel>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="firstName"
                      placeholder={
                        language === "th" ? "ชื่อจริง" : "First name"
                      }
                      value={profile.firstName}
                      onChange={(e) => {
                        setProfile((p) => ({
                          ...p,
                          firstName: e.target.value,
                        }));
                        setProfileErrors((er) => ({
                          ...er,
                          firstName: undefined,
                        }));
                      }}
                      disabled={profileLoading}
                      className="pl-9"
                      aria-invalid={!!profileErrors.firstName}
                    />
                  </div>
                  {profileErrors.firstName && (
                    <p className="text-xs text-destructive mt-1">
                      {profileErrors.firstName}
                    </p>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="lastName">
                    {t("common.lastName")}
                  </FieldLabel>
                  <Input
                    id="lastName"
                    placeholder={language === "th" ? "นามสกุล" : "Last name"}
                    value={profile.lastName}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, lastName: e.target.value }))
                    }
                    disabled={profileLoading}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="email">{t("common.email")}</FieldLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={profile.email}
                    onChange={(e) => {
                      setProfile((p) => ({ ...p, email: e.target.value }));
                      setProfileErrors((er) => ({ ...er, email: undefined }));
                    }}
                    disabled={profileLoading}
                    className="pl-9"
                    aria-invalid={!!profileErrors.email}
                  />
                </div>
                {profileErrors.email && (
                  <p className="text-xs text-destructive mt-1">
                    {profileErrors.email}
                  </p>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="phone">{t("common.phone")}</FieldLabel>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0xx-xxx-xxxx"
                    value={profile.phone}
                    onChange={(e) => {
                      setProfile((p) => ({ ...p, phone: e.target.value }));
                      setProfileErrors((er) => ({ ...er, phone: undefined }));
                    }}
                    disabled={profileLoading}
                    className="pl-9"
                    aria-invalid={!!profileErrors.phone}
                  />
                </div>
                {profileErrors.phone && (
                  <p className="text-xs text-destructive mt-1">
                    {profileErrors.phone}
                  </p>
                )}
              </Field>
              <Button
                type="submit"
                disabled={profileLoading}
                className="w-full sm:w-auto"
              >
                {profileLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("common.loading")}
                  </>
                ) : profileSuccess ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />✓{" "}
                    {t("common.save")}
                  </>
                ) : (
                  t("common.save")
                )}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Accordion: Telegram + Password ── */}
      <Accordion
        type="multiple"
        defaultValue={["telegram"]}
        className="space-y-4"
      >
        {/* Telegram section */}
        <AccordionItem value="telegram" className="border rounded-lg px-0">
          <Card className="border-0 shadow-none">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-2 text-lg font-semibold min-w-0 flex-1 text-left">
                <Send className="h-5 w-5 text-[#2AABEE] shrink-0" />
                <span className="truncate">{t("tenant.profile.telegram")}</span>
                {tgLinked && (
                  <span className="text-xs font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full shrink-0">
                    {t("tenant.profile.telegramLinked")}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <CardDescription className="mb-4">
                {t("tenant.profile.telegramDesc")}
              </CardDescription>
              {tgLinked ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-green-600 dark:text-green-400">
                        {t("tenant.profile.telegramLinked")}
                      </p>
                      {tgChatId && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Chat ID: {tgChatId}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3 pt-1">
                    <p className="text-sm font-medium">
                      {language === "th"
                        ? "เลือกประเภทการแจ้งเตือนที่ต้องการรับ"
                        : "Choose which notifications to receive"}
                    </p>

                    {[
                      {
                        key: "notify_bill" as const,
                        label:
                          language === "th"
                            ? "บิลใหม่ / ใกล้ครบกำหนด"
                            : "New bills / due reminders",
                      },
                      {
                        key: "notify_overdue" as const,
                        label:
                          language === "th"
                            ? "แจ้งเตือนค้างชำระ"
                            : "Overdue notices",
                      },
                      {
                        key: "notify_maintenance" as const,
                        label:
                          language === "th"
                            ? "อัปเดตการแจ้งซ่อม"
                            : "Maintenance updates",
                      },
                      {
                        key: "notify_announcement" as const,
                        label:
                          language === "th"
                            ? "ประกาศทั่วไป"
                            : "General announcements",
                      },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-muted-foreground">
                          {item.label}
                        </span>
                        <Switch
                          checked={prefs[item.key]}
                          onCheckedChange={(v) => handleTogglePref(item.key, v)}
                          disabled={prefsLoading}
                        />
                      </div>
                    ))}

                    <p className="text-xs text-muted-foreground pt-1">
                      {language === "th"
                        ? "หมายเหตุ: ยืนยันการชำระเงินและประกาศฉุกเฉินจะถูกส่งเสมอ ไม่สามารถปิดได้"
                        : "Note: payment confirmations and urgent announcements are always sent and cannot be muted."}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnlink}
                    disabled={tgUnlinkLoading}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    {tgUnlinkLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {language === "th"
                          ? "กำลังยกเลิก..."
                          : "Disconnecting..."}
                      </>
                    ) : (
                      <>
                        <Unlink className="mr-2 h-4 w-4" />
                        {t("tenant.profile.unlinkTelegram")}
                      </>
                    )}
                  </Button>
                </div>
              ) : tgDeepLink ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-3">
                    <p className="text-sm font-medium">
                      {language === "th" ? "วิธีเชื่อมต่อ:" : "How to connect:"}
                    </p>
                    <ol className="text-sm text-muted-foreground space-y-1.5 list-none">
                      {telegramConnectSteps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="bg-primary/20 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      asChild
                      className="flex-1 bg-[#2AABEE] hover:bg-[#2AABEE]/90"
                    >
                      <a
                        href={tgDeepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {language === "th" ? "เปิด Telegram" : "Open Telegram"}
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleGenerateLink}
                      disabled={tgLinkLoading}
                      title={
                        language === "th"
                          ? "สร้างลิงก์ใหม่"
                          : "Generate a new link"
                      }
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  {tgPolling && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {language === "th"
                        ? "รอการเชื่อมต่อ... (ลิงก์หมดอายุใน 10 นาที)"
                        : "Waiting for connection... (link expires in 10 minutes)"}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {language === "th"
                        ? "รับแจ้งเตือนผ่าน Telegram สำหรับ:"
                        : "Get Telegram notifications for:"}
                    </p>
                    <ul className="text-sm space-y-1">
                      {telegramBenefits.map((item) => (
                        <li key={item} className="text-muted-foreground">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    onClick={handleGenerateLink}
                    disabled={tgLinkLoading}
                    className="bg-[#2AABEE] hover:bg-[#2AABEE]/90 w-full sm:w-auto"
                  >
                    {tgLinkLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {language === "th"
                          ? "กำลังสร้างลิงก์..."
                          : "Creating link..."}
                      </>
                    ) : (
                      <>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        {t("tenant.profile.connectTelegram")}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* Password section */}
        <AccordionItem value="password" className="border rounded-lg px-0">
          <Card className="border-0 shadow-none">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-2 text-lg font-semibold min-w-0 flex-1 text-left">
                <Shield className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">
                  {hasPassword
                    ? t("tenant.profile.changePassword")
                    : language === "th"
                      ? "ตั้งรหัสผ่าน"
                      : "Set Password"}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <CardDescription className="mb-4">
                {oauthProvider && !hasPassword
                  ? language === "th"
                    ? `คุณ login ด้วย ${oauthProviderLabel} — ตั้งรหัสผ่านเพื่อให้ login ด้วย username ได้ด้วย (ไม่บังคับ)`
                    : `You signed in with ${oauthProviderLabel} — set a password to also login with username (optional)`
                  : language === "th"
                    ? "ควรใช้รหัสผ่านที่คาดเดาได้ยาก"
                    : "Use a strong password that is hard to guess"}
              </CardDescription>
              <form
                onSubmit={
                  hasPassword ? handlePasswordSubmit : handleSetPasswordSubmit
                }
                noValidate
              >
                <FieldGroup>
                  {/* แสดงช่องรหัสเดิมเฉพาะ user ที่มีรหัสผ่านแล้ว */}
                  {hasPassword && (
                    <Field>
                      <FieldLabel htmlFor="currentPassword">
                        {language === "th"
                          ? "รหัสผ่านปัจจุบัน"
                          : "Current Password"}
                      </FieldLabel>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="currentPassword"
                          type={showCurrent ? "text" : "password"}
                          placeholder="••••••••"
                          value={passwords.currentPassword}
                          onChange={(e) =>
                            setPasswords((p) => ({
                              ...p,
                              currentPassword: e.target.value,
                            }))
                          }
                          disabled={passwordLoading}
                          className="pl-9 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent(!showCurrent)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2 min-w-[40px] min-h-[40px] flex items-center justify-center"
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
                  )}

                  <Field>
                    <FieldLabel htmlFor="newPassword">
                      {hasPassword
                        ? language === "th"
                          ? "รหัสผ่านใหม่"
                          : "New Password"
                        : language === "th"
                          ? "รหัสผ่าน"
                          : "Password"}
                    </FieldLabel>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="newPassword"
                        type={showNew ? "text" : "password"}
                        placeholder="••••••••"
                        value={passwords.newPassword}
                        onChange={(e) => {
                          setPasswords((p) => ({
                            ...p,
                            newPassword: e.target.value,
                          }));
                          setPasswordError("");
                        }}
                        disabled={passwordLoading}
                        className="pl-9 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2 min-w-[40px] min-h-[40px] flex items-center justify-center"
                        tabIndex={-1}
                      >
                        {showNew ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {passwords.newPassword && (
                      <div className="mt-2 space-y-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= strength ? strengthColor : "bg-muted"}`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {language === "th" ? "ความแข็งแรง" : "Strength"}:{" "}
                          <span className="font-medium text-foreground">
                            {strengthLabel}
                          </span>
                        </p>
                        {!isPasswordStrongEnough(passwords.newPassword) && (
                          <p className="text-xs text-muted-foreground">
                            {language === "th"
                              ? "ต้องมีอย่างน้อย 6 ตัวอักษร และมีทั้งตัวอักษรและตัวเลข"
                              : "Must be at least 6 characters with both letters and numbers"}
                          </p>
                        )}
                      </div>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="confirmPassword">
                      {language === "th"
                        ? "ยืนยันรหัสผ่าน"
                        : "Confirm Password"}
                    </FieldLabel>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showConfirm ? "text" : "password"}
                        placeholder="••••••••"
                        value={passwords.confirmPassword}
                        onChange={(e) => {
                          setPasswords((p) => ({
                            ...p,
                            confirmPassword: e.target.value,
                          }));
                          setPasswordError("");
                        }}
                        disabled={passwordLoading}
                        className="pl-9 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2 min-w-[40px] min-h-[40px] flex items-center justify-center"
                        tabIndex={-1}
                      >
                        {showConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {passwords.confirmPassword && (
                      <p
                        className={`text-xs mt-1 ${passwords.newPassword === passwords.confirmPassword ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
                      >
                        {passwords.newPassword === passwords.confirmPassword
                          ? language === "th"
                            ? "✓ รหัสผ่านตรงกัน"
                            : "✓ Passwords match"
                          : language === "th"
                            ? "✗ รหัสผ่านไม่ตรงกัน"
                            : "✗ Passwords do not match"}
                      </p>
                    )}
                  </Field>

                  {passwordError && (
                    <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={
                      passwordLoading ||
                      (hasPassword && !passwords.currentPassword) ||
                      !passwords.newPassword ||
                      !passwords.confirmPassword ||
                      passwords.newPassword !== passwords.confirmPassword ||
                      !isPasswordStrongEnough(passwords.newPassword)
                    }
                    className="w-full sm:w-auto"
                    variant="outline"
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("common.loading")}
                      </>
                    ) : passwordSuccess ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                        {language === "th" ? "สำเร็จ!" : "Done!"}
                      </>
                    ) : hasPassword ? (
                      t("tenant.profile.changePassword")
                    ) : language === "th" ? (
                      "ตั้งรหัสผ่าน"
                    ) : (
                      "Set Password"
                    )}
                  </Button>
                </FieldGroup>
              </form>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
