"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminNavbar } from "@/components/layout/admin-navbar";
import { AdminBottomNav } from "@/components/layout/admin-bottom-nav";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Loader2 } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== "admin") {
      router.replace("/login");
    } else if (user.passwordMustChange) {
      router.replace("/change-password-required");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "admin" || user.passwordMustChange) {
    return null;
  }

  return (
    <SidebarProvider defaultOpen>
      <AdminSidebar />
      <SidebarInset>
        <AdminNavbar />
        {/* pb-20 บนมือถือ เผื่อพื้นที่ให้ bottom nav ไม่บังเนื้อหาท้ายหน้า
            md:pb-6 เพราะ bottom nav ซ่อนบนเว็บ (ใช้ sidebar แทน) */}
        <main className="min-w-0 flex-1 p-3 pb-20 sm:p-4 sm:pb-20 md:p-6 md:pb-6">
          {children}
        </main>
      </SidebarInset>
      {/* Bottom nav แสดงเฉพาะมือถือ (md:hidden ภายใน component) */}
      <AdminBottomNav />
    </SidebarProvider>
  );
}
