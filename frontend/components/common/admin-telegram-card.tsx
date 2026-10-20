//components/common/admin-telegram-card.tsx
// การ์ดเชื่อม Telegram ในหน้าโปรไฟล์ admin — flow เดียวกับหน้าโปรไฟล์ผู้เช่า
// (generate deep link → poll สถานะ → toggle แจ้งเตือน → ยกเลิก) แต่ toggle
// เป็นแจ้งเตือนฝั่ง admin (notify_admin_*)

"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CheckCircle2,
  ExternalLink,
  LinkIcon,
  Loader2,
  RefreshCw,
  Send,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { telegramAPI } from "@/lib/api/telegram.api";
import { notificationPreferenceAPI } from "@/lib/api/notificationPreference.api";
import { useLanguage } from "@/context/language-context";

type AdminNotifyPrefs = {
  notify_admin_payment: boolean;
  notify_admin_maintenance: boolean;
  notify_admin_move_out: boolean;
  notify_admin_registration: boolean;
};

export function AdminTelegramCard() {
  const { t, language } = useLanguage();

  const [tgLinked, setTgLinked] = useState(false);
  const [tgChatId, setTgChatId] = useState<string | null>(null);
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(null);
  const [tgLinkLoading, setTgLinkLoading] = useState(false);
  const [tgPolling, setTgPolling] = useState(false);
  const [tgUnlinkLoading, setTgUnlinkLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefs, setPrefs] = useState<AdminNotifyPrefs>({
    notify_admin_payment: true,
    notify_admin_maintenance: true,
    notify_admin_move_out: true,
    notify_admin_registration: true,
  });

  useEffect(() => {
    telegramAPI
      .getStatus()
      .then((r) => {
        setTgLinked(r.data?.linked ?? false);
        setTgChatId(r.data?.chat_id ?? null);
      })
      .catch(() => {});
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    if (!tgLinked) return;
    notificationPreferenceAPI
      .get()
      .then((r) => {
        const d = r.data?.data;
        if (d) {
          setPrefs({
            notify_admin_payment: d.notify_admin_payment !== 0,
            notify_admin_maintenance: d.notify_admin_maintenance !== 0,
            notify_admin_move_out: d.notify_admin_move_out !== 0,
            notify_admin_registration: d.notify_admin_registration !== 0,
          });
        }
      })
      .catch(() => {});
  }, [tgLinked]);

  const stopPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = null;
    setTgPolling(false);
  };

  const handleGenerateLink = async () => {
    // กันไม่ให้ interval ซ้อนกันถ้ากด "สร้างลิงก์ใหม่" ระหว่างที่ยัง poll อยู่
    stopPolling();
    setTgLinkLoading(true);
    try {
      const res = await telegramAPI.generateLink();
      setTgDeepLink(res.data?.deepLink);
      setTgPolling(true);
      let attempts = 0;
      pollingRef.current = setInterval(async () => {
        attempts++;
        try {
          const r = await telegramAPI.getStatus();
          if (r.data?.linked) {
            setTgLinked(true);
            setTgChatId(r.data?.chat_id);
            setTgDeepLink(null);
            stopPolling();
            toast.success(
              language === "th"
                ? "เชื่อมต่อ Telegram สำเร็จ! 🎉"
                : "Telegram connected successfully! 🎉",
            );
          }
        } catch {}
        if (attempts >= 200) stopPolling();
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
      stopPolling();
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

  const handleTogglePref = async (
    key: keyof AdminNotifyPrefs,
    value: boolean,
  ) => {
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

  const prefItems: { key: keyof AdminNotifyPrefs; label: string }[] = [
    {
      key: "notify_admin_payment",
      label: language === "th" ? "สลิปชำระเงินใหม่" : "New payment slips",
    },
    {
      key: "notify_admin_maintenance",
      label:
        language === "th" ? "คำร้องแจ้งซ่อมใหม่" : "New maintenance requests",
    },
    {
      key: "notify_admin_move_out",
      label: language === "th" ? "คำร้องขอย้ายออก" : "Move-out requests",
    },
    {
      key: "notify_admin_registration",
      label:
        language === "th" ? "ผู้เช่าสมัครบัญชีใหม่" : "New tenant sign-ups",
    },
  ];

  const connectSteps =
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-[#2AABEE]" />
          {t("tenant.profile.telegram")}
          {tgLinked && (
            <span className="text-xs font-normal text-success bg-success/10 px-2 py-0.5 rounded-full">
              {t("tenant.profile.telegramLinked")}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {language === "th"
            ? "รับแจ้งเตือนงานที่ต้องจัดการผ่าน Telegram ของคุณ"
            : "Get alerts for work that needs your attention on Telegram"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tgLinked ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-success">
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
              {prefItems.map((item) => (
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
                  {language === "th" ? "กำลังยกเลิก..." : "Disconnecting..."}
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
            <div className="p-4 rounded-lg bg-info/10 border border-info/20 space-y-3">
              <p className="text-sm font-medium">
                {language === "th" ? "วิธีเชื่อมต่อ:" : "How to connect:"}
              </p>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-none">
                {connectSteps.map((step, i) => (
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
                <a href={tgDeepLink} target="_blank" rel="noopener noreferrer">
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
                  language === "th" ? "สร้างลิงก์ใหม่" : "Generate a new link"
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
              <ul className="text-sm space-y-1 text-muted-foreground">
                {prefItems.map((item) => (
                  <li key={item.key}>• {item.label}</li>
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
                  {language === "th" ? "กำลังสร้างลิงก์..." : "Creating link..."}
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
      </CardContent>
    </Card>
  );
}
