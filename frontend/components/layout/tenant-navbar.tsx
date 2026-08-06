//tenant-navbar.tsx

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
import { Bell, LogOut, User, DoorOpen } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { contractAPI } from "@/lib/api/contract.api";
import { useNotification } from "@/context/notification-context";

export function TenantNavbar() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();

  const [roomNumber, setRoomNumber] = useState<string>("-");
  const { hasUnread, markAsRead } = useNotification();

  useEffect(() => {
    contractAPI
      .getMyContract()
      .then((r) => {
        if (r.data?.room_number) setRoomNumber(r.data.room_number);
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "US";

  return (
    // ✅ px-3 บนมือถือ → px-6 บน sm ขึ้นไป
    <header className="flex h-16 items-center gap-2 sm:gap-4 border-b border-border px-3 sm:px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />

      {/* Room info — ✅ min-w-0 + truncate เพื่อไม่ให้ล้นบนจอเล็ก */}
      <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0">
        <DoorOpen className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {t("tenant.myRoom")} {roomNumber}
          </p>
          <p className="text-xs text-muted-foreground hidden sm:block">
            SDMS
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <ThemeToggle variant="icon-only" />

        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          onClick={() => {
            markAsRead();
            router.push("/tenant/notifications");
          }}
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 sm:gap-3 px-1 sm:px-2"
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium">
                  {user?.name || user?.username}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("common.tenant")}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t("common.myAccount")}</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => router.push("/tenant/profile")}>
              <User className="mr-2 h-4 w-4" />
              {t("common.profile")}
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
