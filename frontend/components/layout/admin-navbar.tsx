//admin-navbar.tsx

"use client";

import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useRouter } from "next/navigation";
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
import { useAdminNotification } from "@/context/admin-notification-context";

export function AdminNavbar() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const { hasUnread, markAllAsRead } = useAdminNotification();

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
            markAllAsRead();
            router.push("/admin/notifications");
          }}
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
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
