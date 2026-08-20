//tenant/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DoorOpen,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  FileText,
  Wrench,
  UserCircle2,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { billAPI } from "@/lib/api/bill.api";
import { maintenanceAPI } from "@/lib/api/maintenance.api";
import { announcementAPI } from "@/lib/api/announcement.api";
import { contractAPI } from "@/lib/api/contract.api";
import { useLanguage } from "@/context/language-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bill {
  bill_id: number;
  bill_month: number;
  bill_year: number;
  total_amount: number;
  due_date: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
}

interface MaintenanceRequest {
  request_id: number;
  category: string;
  status: string;
  created_at: string;
}

interface Announcement {
  announcement_id: number;
  title: string;
  content: string;
  published_at: string;
  is_pinned: number;
}

interface Contract {
  contract_id: number;
  room_number: string;
  room_id: number;
  start_date: string;
  end_date: string;
  rent_amount: number;
  deposit_amount: number;
  status: string;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);

const formatDate = (d: string, lang: string) =>
  new Date(d).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// ── Component ──────────────────────────────────────────────────────────────────

export default function TenantDashboard() {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const [bills, setBills] = useState<Bill[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch all data ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [billRes, maintRes, annRes, contractRes] =
          await Promise.allSettled([
            billAPI.getMyBills(),
            maintenanceAPI.getMyRequests(),
            announcementAPI.getAll(),
            contractAPI.getMyContract(),
          ]);

        if (billRes.status === "fulfilled") setBills(billRes.value.data ?? []);
        if (maintRes.status === "fulfilled")
          setMaintenance(maintRes.value.data ?? []);
        if (annRes.status === "fulfilled")
          setAnnouncements(annRes.value.data ?? []);
        if (contractRes.status === "fulfilled")
          setContract(contractRes.value.data ?? null);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const pendingBill = bills.find(
    (b) => b.status === "pending" || b.status === "overdue",
  );
  const latestBill = bills[0];
  const openMaintenanceCount = maintenance.filter(
    (m) => m.status !== "resolved" && m.status !== "cancelled",
  ).length;
  const latestMaintenance = maintenance[0];

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  const quickLinks = [
    {
      href: "/tenant/bills",
      icon: Receipt,
      title: t("bills.list"),
      subtitle: latestBill
        ? `${t(`month.${latestBill.bill_month}`)} ${latestBill.bill_year} • ${t("bills.dueDate")} ${formatDate(latestBill.due_date, language)}`
        : t("common.noData"),
    },
    {
      href: "/tenant/contract",
      icon: FileText,
      title: t("tenant.myContract"),
      subtitle: contract
        ? `${t("contracts.endDate")} ${formatDate(contract.end_date, language)}`
        : t("common.noData"),
    },
    {
      href: "/tenant/maintenance",
      icon: Wrench,
      title: t("menu.maintenance"),
      subtitle: latestMaintenance
        ? `${t("common.latestStatus")}: ${t(`status.${latestMaintenance.status}`)}`
        : t("maintenance.subtitle"),
      badge: openMaintenanceCount > 0 ? openMaintenanceCount : undefined,
    },
    {
      href: "/tenant/profile",
      icon: UserCircle2,
      title: `${t("tenant.profile.title")} & Telegram`,
      subtitle: t("tenant.profileSubtitle"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {t("tenant.welcome")}, {user?.username || t("common.tenant")}
        </h1>
        <p className="text-muted-foreground mt-2">{t("rooms.subtitle")}</p>
      </div>

      {/* Hero card — room + outstanding balance in one place, matching the
          reference design's single dark "room" card at the top of the
          tenant home screen instead of two separate summary cards. */}
      {contract && (
        <div className="rounded-2xl bg-primary text-primary-foreground p-5 sm:p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/15 shrink-0">
              <DoorOpen className="h-6 w-6 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold truncate">
                {t("tenant.room")} {contract.room_number}
              </p>
              <p className="text-xs text-primary-foreground/50">
                {t("tenant.rentPerMonth")}{" "}
                {formatCurrency(Number(contract.rent_amount))}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-primary-foreground/10 flex items-center justify-between gap-3">
            {pendingBill ? (
              <>
                <div className="min-w-0">
                  <p className="text-xs text-primary-foreground/50 flex items-center gap-1">
                    {pendingBill.status === "overdue" && (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    {pendingBill.status === "overdue"
                      ? t("tenant.overdueBill")
                      : t("tenant.pendingBill")}
                  </p>
                  <p className="text-2xl font-bold truncate">
                    {formatCurrency(pendingBill.total_amount)}
                  </p>
                </div>
                <Link href="/tenant/payment" className="shrink-0">
                  <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                    {t("tenant.payNow")}
                  </Button>
                </Link>
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm text-primary-foreground/70">
                <CheckCircle2 className="h-4 w-4 text-accent" />
                {t("tenant.noOutstandingBalance")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quick links — icon-badge list cards mirroring the reference
          design's home screen menu (bill / contract / maintenance /
          profile), each showing a live status pulled from real data
          instead of being a plain static nav shortcut. */}
      <div className="space-y-3">
        {quickLinks.map((item) => (
          <Link key={item.href} href={item.href} className="block">
            <Card className="hover:border-accent/40 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2.5 rounded-full bg-accent/15 shrink-0">
                  <item.icon className="h-5 w-5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{item.title}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {item.subtitle}
                  </p>
                </div>
                {item.badge !== undefined && (
                  <span className="shrink-0 text-xs font-semibold bg-warning/20 text-warning-foreground px-2 py-1 rounded-full">
                    {item.badge}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5" />
              {t("announcements.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {announcements.slice(0, 2).map((ann) => (
                <div
                  key={ann.announcement_id}
                  className={`p-4 rounded-lg ${
                    ann.is_pinned
                      ? "bg-accent/10 border border-accent/30"
                      : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{ann.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(ann.published_at, language)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{ann.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
