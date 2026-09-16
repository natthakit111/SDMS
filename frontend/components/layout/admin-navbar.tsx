//admin-navbar.tsx

"use client";

import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, LogOut, User, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { paymentAPI } from "@/lib/api/payment.api";
import { maintenanceAPI } from "@/lib/api/maintenance.api";

export function AdminNavbar() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  // ⚠️ FIX: เดิมกระดิ่งเช็คของใหม่จาก payments+maintenance แต่กดแล้วพาไป
  // /admin/announcements เสมอ — ไม่ว่าของใหม่จริงๆ จะเป็นสลิปรอตรวจหรือ
  // แจ้งซ่อมใหม่ก็ตาม ตอนนี้จำไว้ว่ารายการล่าสุดที่ยังไม่อ่านเป็นประเภทไหน
  // แล้วพาไปหน้านั้นแทน (ถ้าไม่มีของใหม่เลย ยังคง fallback ไปหน้าประกาศ
  // เหมือนพฤติกรรมเดิม)
  const [notifyTarget, setNotifyTarget] = useState("/admin/announcements");

  useEffect(() => {
    const ADMIN_KEY = "admin_notif_last_seen";
    const lastSeen = localStorage.getItem(ADMIN_KEY);
    const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0);

    Promise.allSettled([
      paymentAPI.getAll({ status: "pending_verify" }),
      maintenanceAPI.getAll({ status: "pending" }),
    ]).then(([payRes, maintRes]) => {
      const payments =
        payRes.status === "fulfilled" ? (payRes.value.data ?? []) : [];
      const maintenance =
        maintRes.status === "fulfilled" ? (maintRes.value.data ?? []) : [];

      const newestOf = (items: any[]) =>
        items.reduce((max: Date | null, item: any) => {
          const d = new Date(item.created_at || item.submitted_at || 0);
          return !max || d > max ? d : max;
        }, null as Date | null);

      const candidates = [
        { date: newestOf(payments), path: "/admin/payments" },
        { date: newestOf(maintenance), path: "/admin/maintenance" },
      ].filter((c): c is { date: Date; path: string } => !!c.date && c.date > lastSeenDate);

      if (candidates.length === 0) {
        setUnreadCount(0);
        return;
      }
      candidates.sort((a, b) => b.date.getTime() - a.date.getTime());
      setNotifyTarget(candidates[0].path);
      setUnreadCount(1);
    });
  }, []);

  const handleLogout = () => {
    logout();
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "AD";

  return (
    // ✅ px-3 บนมือถือ → px-6 บน sm ขึ้นไป, gap-2 → gap-4
    <header className="flex h-16 items-center gap-2 sm:gap-4 border-b border-border px-3 sm:px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-medium text-muted-foreground truncate">
          SDMS
        </h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <ThemeToggle variant="icon-only" />

        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          onClick={() => {
            localStorage.setItem(
              "admin_notif_last_seen",
              new Date().toISOString(),
            );
            setUnreadCount(0);
            // พาไปหน้าของรายการที่ยังไม่อ่านล่าสุด (สลิปรอตรวจ → /admin/payments,
            // แจ้งซ่อมใหม่ → /admin/maintenance) ถ้าไม่มีของใหม่เลย fallback
            // ไปหน้าประกาศเหมือนเดิม (เดิมชี้ไป /admin/notifications ซึ่งเป็น
            // หน้าซ้ำซ้อนกับ /admin/announcements — ลบหน้านั้นทิ้งไปแล้ว)
            router.push(notifyTarget);
          }}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* ✅ px-1 บนมือถือ, gap-2 sm:gap-3 */}
            <Button
              variant="ghost"
              className="flex items-center gap-2 sm:gap-3 px-1 sm:px-2"
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {/* ✅ hidden sm:block — ซ่อนชื่อบนมือถือ แสดงบน sm ขึ้นไป (เดิมก็ทำอยู่แล้ว) */}
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium">
                  {user?.name || user?.username}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("common.admin")}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t("common.myAccount")}</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => router.push("/admin/profile")}>
              <User className="mr-2 h-4 w-4" />
              {t("common.profile")}
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => router.push("/admin/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              {t("common.settings")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">
              {t("common.language")}
            </DropdownMenuLabel>

            <DropdownMenuItem
              onClick={() => setLanguage("th")}
              className={language === "th" ? "bg-primary/20" : ""}
            >
              <span className="mr-2">🇹🇭</span>
              {t("common.thai")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLanguage("en")}
              className={language === "en" ? "bg-primary/20" : ""}
            >
              <span className="mr-2">🇬🇧</span>
              {t("common.english")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("common.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
