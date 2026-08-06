//tenant-sidebar.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/language-context";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Building2,
  LayoutDashboard,
  Receipt,
  CreditCard,
  Wrench,
  Bell,
  FileText,
  History,
  LogOut,
  Languages,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

export function TenantSidebar() {
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();
  const { setOpenMobile, isMobile } = useSidebar();

  const menuItems = [
    {
      group: t("menu.group.main"),
      items: [
        { title: t("menu.dashboard"), href: "/tenant", icon: LayoutDashboard },
      ],
    },
    {
      group: t("menu.group.finance"),
      items: [
        {
          title: t("tenant.bills.title"),
          href: "/tenant/bills",
          icon: Receipt,
        },
        {
          title: t("tenant.payment.title"),
          href: "/tenant/payment",
          icon: CreditCard,
        },
        {
          title: t("payments.history"),
          href: "/tenant/payment-history",
          icon: History,
        },
      ],
    },
    {
      group: t("menu.group.other"),
      items: [
        {
          title: t("maintenance.title"),
          href: "/tenant/maintenance",
          icon: Wrench,
        },
        {
          title: t("announcements.title"),
          href: "/tenant/announcements",
          icon: Bell,
        },
        {
          title: t("tenant.contract.title"),
          href: "/tenant/contract",
          icon: FileText,
        },
        {
          title: t("tenant.moveout.title"),
          href: "/tenant/move-out",
          icon: LogOut,
        },
        {
          title: t("tenant.profile.title"),
          href: "/tenant/profile",
          icon: User,
        },
      ],
    },
  ];

  return (
    // ✅ เพิ่ม collapsible="offcanvas" → บนมือถือ sidebar จะ slide in/out แทนที่จะทับ content
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/tenant" className="flex items-center gap-3 px-4 py-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg">SDMS</h1>
            <p className="text-xs text-muted-foreground">
              {t("common.tenant")}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {menuItems.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/tenant" &&
                    pathname.startsWith(item.href + "/"));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(isActive && "bg-primary/20 text-primary")}
                    >
                      <Link
                        href={item.href}
                        onClick={() => isMobile && setOpenMobile(false)}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          {/* Theme Toggle */}
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="text-sm text-muted-foreground flex-1">
                {language === "th" ? "ธีม" : "Theme"}
              </span>
              <ThemeToggle variant="dropdown" />
            </div>
          </SidebarMenuItem>

          {/* Language Toggle */}
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Languages className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground flex-1">
                {t("common.language")}
              </span>
              <div className="flex rounded-md border border-border overflow-hidden text-xs font-medium">
                <button
                  onClick={() => setLanguage("th")}
                  className={cn(
                    "px-2.5 py-1 transition-colors",
                    language === "th"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground",
                  )}
                >
                  TH
                </button>
                <button
                  onClick={() => setLanguage("en")}
                  className={cn(
                    "px-2.5 py-1 transition-colors border-l border-border",
                    language === "en"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground",
                  )}
                >
                  EN
                </button>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
