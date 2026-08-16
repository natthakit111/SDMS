//admin/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/context/language-context";
import { StatsCard } from "@/components/common/stats-card";
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
  Users,
  Receipt,
  Banknote,
  AlertTriangle,
  ArrowRight,
  Wrench,
  Loader2,
} from "lucide-react";
import { roomAPI } from "@/lib/api/room.api";
import { billAPI } from "@/lib/api/bill.api";
import { maintenanceAPI } from "@/lib/api/maintenance.api";
import { tenantAPI } from "@/lib/api/tenant.api";
// ⚠️ เพิ่ม: ต้องดึง payments เข้ามาด้วย เพราะการ์ด "ประวัติการชำระเงิน"
// ควรนับจากรายการชำระเงินจริง (payments table) ไม่ใช่จำนวนบิลที่
// status='paid' — เดิมนับจากบิลทำให้ตัวเลขไม่ตรงกับหน้า Payments/Excel
// export ที่นับจาก payment record โดยตรง
import { paymentAPI } from "@/lib/api/payment.api";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface RoomStats {
  total: number;
  occupied: number;
  available: number;
  maintenance: number;
}
interface Room {
  room_id: number;
  room_number: string;
  status: "available" | "occupied" | "maintenance";
}
interface Bill {
  bill_id: number;
  room_id: number;
  room_number?: string;
  total_amount: number;
  status: "pending" | "paid" | "overdue" | "cancelled";
  bill_month: number;
  bill_year: number;
}
interface MaintenanceRequest {
  request_id: number;
  category: string;
  description: string;
  room_number?: string;
  status: "pending" | "in_progress" | "resolved" | "cancelled";
  priority: "low" | "medium" | "high";
}
// ⚠️ เพิ่ม: type สำหรับ payment record (เท่าที่ dashboard ต้องใช้จริง)
interface PaymentRecord {
  payment_id: number;
  amount_paid: number;
  status: "pending_verify" | "verified" | "rejected";
}

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [roomStats, setRoomStats] = useState<RoomStats>({
    total: 0,
    occupied: 0,
    available: 0,
    maintenance: 0,
  });
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [tenantCount, setTenantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [
          statsRes,
          roomsRes,
          billsRes,
          maintenanceRes,
          tenantsRes,
          paymentsRes,
        ] = await Promise.all([
          roomAPI.getStats(),
          roomAPI.getAll(),
          billAPI.getAll(),
          maintenanceAPI.getAll(),
          tenantAPI.getAll(),
          paymentAPI.getAll(),
        ]);
        setRoomStats(statsRes.data ?? statsRes);
        setRooms(roomsRes.data ?? roomsRes ?? []);
        setBills(billsRes.data ?? billsRes ?? []);
        setMaintenance(maintenanceRes.data ?? maintenanceRes ?? []);
        setPayments(paymentsRes.data ?? paymentsRes ?? []);
        const tenantData = tenantsRes.data ?? tenantsRes ?? [];
        setTenantCount(Array.isArray(tenantData) ? tenantData.length : 0);
      } catch (err: any) {
        setError(err.response?.data?.message ?? t("common.noData"));
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const pendingBills = bills.filter(
    (b) => b.status === "pending" || b.status === "overdue",
  );
  const overdueBills = bills.filter((b) => b.status === "overdue");
  const pendingAmount = pendingBills.reduce(
    (sum, b) => sum + Number(b.total_amount),
    0,
  );
  // ⚠️ FIX: เปลี่ยนจากนับ "บิลที่ status=paid" มาเป็นนับ "payment ที่
  // status=verified" โดยตรง — ตรงกับความหมายของชื่อการ์ด "ประวัติการ
  // ชำระเงิน" มากกว่า และตัวเลขจะสอดคล้องกับหน้า Payments / Excel export
  // ที่นับจาก payment record เหมือนกันแล้ว (ไม่ใช่คนละ metric อีกต่อไป)
  const verifiedPayments = payments.filter((p) => p.status === "verified");
  const verifiedAmount = verifiedPayments.reduce(
    (sum, p) => sum + Number(p.amount_paid),
    0,
  );
  const pendingMaintenance = maintenance.filter(
    (m) => m.status === "pending" || m.status === "in_progress",
  );
  const recentBills = bills.slice(0, 5);
  const recentMaintenance = maintenance.slice(0, 5);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={() => window.location.reload()}>
          {t("common.confirm")}
        </Button>
      </div>
    );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{t("menu.dashboard")}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {t("rooms.subtitle")}
        </p>
      </div>

      {/* Stats Cards — 2 คอลัมน์บนมือถือ, 4 คอลัมน์บนจอใหญ่ */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatsCard
          title={t("rooms.title")}
          value={`${roomStats.occupied}/${roomStats.total}`}
          description={`${t("status.available")} ${roomStats.available}`}
          icon={DoorOpen}
          variant="primary"
        />
        <StatsCard
          title={t("tenants.title")}
          value={tenantCount}
          description={t("status.active")}
          icon={Users}
          variant="default"
        />
        <StatsCard
          title={t("bills.outstandingAmount")}
          value={formatCurrency(pendingAmount)}
          description={`${pendingBills.length} ${t("bills.list")}`}
          icon={Receipt}
          variant={overdueBills.length > 0 ? "destructive" : "warning"}
        />
        {/* ⚠️ FIX: value/description เปลี่ยนมาใช้ verifiedPayments แทน
            paidBills — ให้ตรงกับชื่อการ์ด "ประวัติการชำระเงิน" จริงๆ */}
        <StatsCard
          title={t("payments.history")}
          value={formatCurrency(verifiedAmount)}
          description={`${t("common.all")} ${verifiedPayments.length} ${t("payment.list")}`}
          icon={Banknote}
          variant="success"
        />
      </div>

      {/* Alerts */}
      {(overdueBills.length > 0 || pendingMaintenance.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
          {overdueBills.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 rounded-lg bg-destructive/20 p-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-destructive">
                      {t("status.overdue")}
                    </h3>
                    <p className="truncate text-sm text-muted-foreground">
                      {overdueBills.length} {t("bills.list")}
                    </p>
                  </div>
                  <Link href="/admin/bills?status=overdue" className="shrink-0">
                    <Button variant="destructive" size="sm">
                      {t("common.view")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
          {pendingMaintenance.length > 0 && (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 rounded-lg bg-warning/20 p-2">
                    <Wrench className="h-5 w-5 text-warning" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-warning">
                      {t("status.pending")}
                    </h3>
                    <p className="truncate text-sm text-muted-foreground">
                      {pendingMaintenance.length} {t("maintenance.list")}
                    </p>
                  </div>
                  <Link href="/admin/maintenance" className="shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-warning text-warning hover:bg-warning hover:text-warning-foreground"
                    >
                      {t("common.view")}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-4 sm:p-6">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">
                {t("bills.list")}
              </CardTitle>
              <CardDescription className="truncate">
                {t("bills.subtitle")}
              </CardDescription>
            </div>
            <Link href="/admin/bills" className="shrink-0">
              <Button variant="ghost" size="sm">
                <span className="hidden sm:inline">{t("common.viewAll")}</span>
                <ArrowRight className="h-4 w-4 sm:ml-2" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-1">
              {recentBills.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("common.noData")}
                </p>
              )}
              {recentBills.map((bill) => (
                <div
                  key={bill.bill_id}
                  className="flex items-center justify-between gap-3 border-b py-2.5 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="shrink-0 rounded-lg bg-muted p-2">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {t("rooms.roomNumber")}{" "}
                        {bill.room_number ?? bill.room_id}
                      </p>
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {bill.bill_month}/{bill.bill_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="font-semibold tabular-nums">
                      {formatCurrency(bill.total_amount)}
                    </p>
                    <BillStatusBadge status={bill.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-4 sm:p-6">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg">
                {t("maintenance.list")}
              </CardTitle>
              <CardDescription className="truncate">
                {t("maintenance.subtitle")}
              </CardDescription>
            </div>
            <Link href="/admin/maintenance" className="shrink-0">
              <Button variant="ghost" size="sm">
                <span className="hidden sm:inline">{t("common.viewAll")}</span>
                <ArrowRight className="h-4 w-4 sm:ml-2" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-1">
              {recentMaintenance.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("common.noData")}
                </p>
              )}
              {recentMaintenance.map((req) => (
                <div
                  key={req.request_id}
                  className="flex items-center justify-between gap-3 border-b py-2.5 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="shrink-0 rounded-lg bg-muted p-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{req.category}</p>
                      <p className="truncate text-xs text-muted-foreground sm:text-sm">
                        {t("rooms.roomNumber")} {req.room_number ?? "-"}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <MaintenanceStatusBadge status={req.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room Overview */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">
            {t("rooms.list")}
          </CardTitle>
          <CardDescription>{t("rooms.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {rooms.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("common.noData")}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-6 lg:grid-cols-8">
              {rooms.map((room) => (
                <Link
                  key={room.room_id}
                  href="/admin/rooms"
                  className={`rounded-lg border p-2.5 text-center transition-colors hover:border-primary sm:p-3
                    ${room.status === "available" ? "bg-success/10 border-success/30" : ""}
                    ${room.status === "occupied" ? "bg-primary/10 border-primary/30" : ""}
                    ${room.status === "maintenance" ? "bg-warning/10 border-warning/30" : ""}`}
                >
                  <p className="text-base font-bold sm:text-lg">
                    {room.room_number}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">
                    {room.status === "available" && t("status.available")}
                    {room.status === "occupied" && t("status.occupied")}
                    {room.status === "maintenance" && t("status.maintenance")}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
