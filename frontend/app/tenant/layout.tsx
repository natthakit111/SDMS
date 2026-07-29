//app/tenant/layout.tsx

"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { TenantSidebar } from "@/components/layout/tenant-sidebar";
import { TenantNavbar } from "@/components/layout/tenant-navbar";
import { TenantBottomNav } from "@/components/layout/tenant-bottom-nav";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { NotificationProvider } from "@/context/notification-context";
import { Loader2 } from "lucide-react";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "tenant")) {
      const query = searchParams.toString();
      const fullPath = query ? `${pathname}?${query}` : pathname;
      router.replace(`/login?redirect=${encodeURIComponent(fullPath)}`);
    }
  }, [user, isLoading, router, pathname, searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "tenant") return null;

  return (
    <NotificationProvider>
      <SidebarProvider
        defaultOpen={
          typeof window !== "undefined" ? window.innerWidth >= 768 : true
        }
      >
        <div className="hidden md:block">
          <TenantSidebar />
        </div>
        <SidebarInset>
          <TenantNavbar />
          <main className="flex-1 p-3 sm:p-4 md:p-6 pb-20 md:pb-6">
            {children}
          </main>
        </SidebarInset>
        <TenantBottomNav />
      </SidebarProvider>
    </NotificationProvider>
  );
}