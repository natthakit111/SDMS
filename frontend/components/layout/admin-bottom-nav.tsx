// frontend/components/layout/admin-bottom-nav.tsx
// Mobile bottom nav for /admin/* — mirrors tenant-bottom-nav.tsx but points
// at the admin routes (see admin-sidebar.tsx for the full route list).

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/language-context";
import {
  LayoutDashboard,
  DoorOpen,
  Receipt,
  CreditCard,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminBottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    { href: "/admin", icon: LayoutDashboard, label: t("menu.dashboard") },
    { href: "/admin/rooms", icon: DoorOpen, label: t("menu.rooms") },
    { href: "/admin/bills", icon: Receipt, label: t("menu.bills") },
    { href: "/admin/payments", icon: CreditCard, label: t("menu.payments") },
    { href: "/admin/profile", icon: UserCircle, label: t("common.profile") },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden
                    bg-background/95 backdrop-blur-sm
                    border-t border-border
                    safe-area-pb"
    >
      <div className="flex items-stretch h-16">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href + "/"));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors min-h-[44px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 transition-transform",
                  isActive && "scale-110",
                )}
              />
              <span className="truncate max-w-[60px] text-center leading-tight">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
