//tenant/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BillStatusBadge,
  MaintenanceStatusBadge,
} from "@/components/common/status-badge";
import {
  DoorOpen,
  Bell,
  ArrowRight,
  AlertTriangle,
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

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {t("tenant.welcome")}, {user?.username || t("common.tenant")}
        </h1>
        <p className="text-muted-foreground mt-2">{t("rooms.subtitle")}</p>
      </div>

      {/* Pending Bill Alert — moved to top: this is the most actionable item
          a tenant needs to see, so it should not be buried below static
          room info. */}
      {pendingBill && (
        <Card
          className={
            pendingBill.status === "overdue"
              ? "border-destructive/50 bg-destructive/5"
              : "border-yellow-500/50 bg-yellow-500/5"
          }
        >
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    pendingBill.status === "overdue"
                      ? "bg-destructive/20"
                      : "bg-yellow-500/20"
                  }`}
                >
                  <AlertTriangle
                    className={`h-5 w-5 ${
                      pendingBill.status === "overdue"
                        ? "text-destructive"
                        : "text-yellow-600"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <h3
                    className={`font-semibold ${
                      pendingBill.status === "overdue" ? "text-destructive" : ""
                    }`}
                  >
                    {pendingBill.status === "overdue"
                      ? t("tenant.overdueBill")
                      : t("tenant.pendingBill")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t(`month.${pendingBill.bill_month}`)}{" "}
                    {pendingBill.bill_year} • {t("bills.totalAmount")}{" "}
                    {formatCurrency(pendingBill.total_amount)}
                  </p>
                </div>
              </div>
              <Link href="/tenant/payment" className="w-full sm:w-auto">
                <Button
                  variant={
                    pendingBill.status === "overdue" ? "destructive" : "default"
                  }
                  className="w-full sm:w-auto"
                >
                  {t("tenant.payNow")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Room + Contract summary — merged into a single card so tenants
          don't have to scroll past duplicate info (room, rent, dates)
          that used to appear twice on this page. */}
      {contract && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 sm:p-4 rounded-xl bg-primary/20 shrink-0">
                  <DoorOpen className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    {t("tenant.myRoom")}
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold truncate">
                    {contract.room_number}
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm text-muted-foreground">
                  {t("tenant.rentPerMonth")}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-primary">
                  {formatCurrency(Number(contract.rent_amount))}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm pt-4 border-t border-primary/10">
              <div>
                <p className="text-muted-foreground">
                  {t("contracts.startDate")}
                </p>
                <p className="font-medium">
                  {formatDate(contract.start_date, language)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t("contracts.endDate")}
                </p>
                <p className="font-medium">
                  {formatDate(contract.end_date, language)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t("contracts.deposit")}
                </p>
                <p className="font-medium">
                  {formatCurrency(Number(contract.deposit_amount))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Note: the Quick Actions grid (Bills / Payment / Maintenance / Contract)
          was removed here — it duplicated the bottom navigation bar 1:1 and
          added an extra scroll-length of buttons with no new information. */}

      {/* Bills + Maintenance — trimmed to 2 items each; this is a dashboard
          summary, not the full list page (which is one tap away via
          "View all"). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bills */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t("bills.list")}</CardTitle>
              <CardDescription>{t("bills.subtitle")}</CardDescription>
            </div>
            <Link href="/tenant/bills">
              <Button variant="ghost" size="sm">
                {t("common.viewAll")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bills.slice(0, 2).map((bill) => (
                <div
                  key={bill.bill_id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">
                      {t(`month.${bill.bill_month}`)} {bill.bill_year}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("bills.dueDate")} {formatDate(bill.due_date, language)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(bill.total_amount)}
                    </p>
                    <BillStatusBadge status={bill.status} />
                  </div>
                </div>
              ))}
              {bills.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  {t("common.noData")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Maintenance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t("maintenance.list")}</CardTitle>
              <CardDescription>{t("maintenance.subtitle")}</CardDescription>
            </div>
            <Link href="/tenant/maintenance">
              <Button variant="ghost" size="sm">
                {t("common.viewAll")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {maintenance.slice(0, 2).map((req) => (
                <div
                  key={req.request_id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{req.category}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("common.created")}{" "}
                      {formatDate(req.created_at, language)}
                    </p>
                  </div>
                  <MaintenanceStatusBadge status={req.status} />
                </div>
              ))}
              {maintenance.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  {t("common.noData")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
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
                      ? "bg-yellow-500/10 border border-yellow-500/30"
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
