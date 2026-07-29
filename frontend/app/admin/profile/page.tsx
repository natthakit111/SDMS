"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Save, Lock, Loader2, User } from "lucide-react";
import { authAPI } from "@/lib/api/auth.api";
import { useLanguage } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";

// ── Validation helpers ─────────────────────────────────────
const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

// เบอร์โทรไทย: ขึ้นต้นด้วย 0 ตามด้วยตัวเลข รวม 9-10 หลัก (ตัด - ออกก่อนเช็ค)
const isValidPhone = (value: string) => {
  const digitsOnly = value.replace(/-/g, "");
  return /^0\d{8,9}$/.test(digitsOnly);
};

export default function ProfilePage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  // ── Profile ───────────────────────────────────────────────
  const [firstName, setFirstName] = useState(user?.name?.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(user?.name?.split(" ")[1] ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Security ──────────────────────────────────────────────
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "AD";

  const handleSaveProfile = async () => {
    // ── Validation ──────────────────────────────────────────
    if (!firstName.trim()) {
      toast.error(t("settings.errorFillAll"));
      return;
    }

    if (email && !isValidEmail(email)) {
      toast.error(t("settings.errorInvalidEmail"));
      return;
    }

    if (phone && !isValidPhone(phone)) {
      toast.error(t("settings.errorInvalidPhone"));
      return;
    }

    try {
      setSavingProfile(true);
      await authAPI.updateProfile({ firstName, lastName, email, phone });
      toast.success(t("common.saveSuccess"));
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? t("settings.saveError");
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error(t("settings.errorFillPassword"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("settings.errorPasswordMismatch"));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t("settings.errorPasswordLength"));
      return;
    }
    if (newPassword === oldPassword) {
      toast.error(t("settings.errorPasswordSame"));
      return;
    }
    try {
      setChangingPassword(true);
      await authAPI.changePassword(oldPassword, newPassword);
      toast.success(t("settings.passwordChangeSuccess"));
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? t("common.error");
      toast.error(
        msg.toLowerCase().includes("incorrect")
          ? t("settings.errorOldPassword")
          : msg,
      );
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">{t("common.profile")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("settings.profileDesc")}
        </p>
      </div>

      {/* Avatar + username */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-lg">
                {user?.name || user?.username}
              </p>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("common.admin")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t("common.profile")}
          </CardTitle>
          <CardDescription>{t("settings.profileDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                {t("common.firstName")}
              </label>
              <Input
                placeholder={t("common.firstName")}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                {t("common.lastName")}
              </label>
              <Input
                placeholder={t("common.lastName")}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                {t("common.email")}
              </label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => {
                  if (email && !isValidEmail(email)) {
                    toast.error(t("settings.errorInvalidEmail"));
                  }
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                {t("common.phone")}
              </label>
              <Input
                placeholder="081-234-5678"
                value={phone}
                maxLength={12} // เผื่อพิมพ์ขีด (-) ด้วย
                onChange={(e) => {
                  // อนุญาตเฉพาะตัวเลขกับขีด (-)
                  const cleaned = e.target.value.replace(/[^0-9-]/g, "");
                  setPhone(cleaned);
                }}
                onBlur={() => {
                  if (phone && !isValidPhone(phone)) {
                    toast.error(t("settings.errorInvalidPhone"));
                  }
                }}
              />
            </div>
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="gap-2"
          >
            {savingProfile ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t("common.save")}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t("settings.securityTitle")}
          </CardTitle>
          <CardDescription>{t("settings.securityDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">
              {t("settings.oldPassword")}
            </label>
            <Input
              type="password"
              placeholder={t("settings.oldPasswordPlaceholder")}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              {t("settings.newPassword")}
            </label>
            <Input
              type="password"
              placeholder={t("settings.newPasswordPlaceholder")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              {t("settings.confirmPassword")}
            </label>
            <Input
              type="password"
              placeholder={t("settings.confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPassword}
            className="gap-2"
          >
            {changingPassword ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {t("settings.changePassword")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
