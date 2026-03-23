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
import { formatCurrency } from "@/lib/mock-data";
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
  const [tenantCount, setTenantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, roomsRes, billsRes, maintenanceRes, tenantsRes] =
          await Promise.all([
            roomAPI.getStats(),
            roomAPI.getAll(),
            billAPI.getAll(),
            maintenanceAPI.getAll(),
            tenantAPI.getAll(),
          ]);
        setRoomStats(statsRes.data ?? statsRes);
        setRooms(roomsRes.data ?? roomsRes ?? []);
        setBills(billsRes.data ?? billsRes ?? []);
        setMaintenance(maintenanceRes.data ?? maintenanceRes ?? []);
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
  const paidBills = bills.filter((b) => b.status === "paid");
  const pendingAmount = pendingBills.reduce(
    (sum, b) => sum + Number(b.total_amount),
    0,
  );
  const monthlyIncome = paidBills.reduce(
    (sum, b) => sum + Number(b.total_amount),
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("menu.dashboard")}</h1>
        <p className="text-muted-foreground">{t("rooms.subtitle")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          title={t("bills.totalAmount")}
          value={formatCurrency(pendingAmount)}
          description={`${pendingBills.length} ${t("bills.list")}`}
          icon={Receipt}
          variant={overdueBills.length > 0 ? "destructive" : "warning"}
        />
        <StatsCard
          title={t("payments.history")}
          value={formatCurrency(monthlyIncome)}
          description={`${t("common.all")} ${paidBills.length} ${t("bills.list")}`}
          icon={Banknote}
          variant="success"
        />
      </div>

      {/* Alerts */}
      {(overdueBills.length > 0 || pendingMaintenance.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {overdueBills.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-destructive/20">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-destructive">
                      {t("status.overdue")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {overdueBills.length} {t("bills.list")}
                    </p>
                  </div>
                  <Link href="/admin/bills?status=overdue">
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
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-warning/20">
                    <Wrench className="h-5 w-5 text-warning-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-warning-foreground">
                      {t("status.pending")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {pendingMaintenance.length} {t("maintenance.list")}
                    </p>
                  </div>
                  <Link href="/admin/maintenance">
                    <Button variant="outline" size="sm">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t("bills.list")}</CardTitle>
              <CardDescription>{t("bills.subtitle")}</CardDescription>
            </div>
            <Link href="/admin/bills">
              <Button variant="ghost" size="sm">
                {t("common.viewAll")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentBills.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("common.noData")}
                </p>
              )}
              {recentBills.map((bill) => (
                <div
                  key={bill.bill_id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {t("rooms.roomNumber")}{" "}
                        {bill.room_number ?? bill.room_id}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {bill.bill_month}/{bill.bill_year}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
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
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t("maintenance.list")}</CardTitle>
              <CardDescription>{t("maintenance.subtitle")}</CardDescription>
            </div>
            <Link href="/admin/maintenance">
              <Button variant="ghost" size="sm">
                {t("common.viewAll")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentMaintenance.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("common.noData")}
                </p>
              )}
              {recentMaintenance.map((req) => (
                <div
                  key={req.request_id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{req.category}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("rooms.roomNumber")} {req.room_number ?? "-"}
                      </p>
                    </div>
                  </div>
                  <MaintenanceStatusBadge status={req.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("rooms.list")}</CardTitle>
          <CardDescription>{t("rooms.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("common.noData")}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {rooms.map((room) => (
                <Link
                  key={room.room_id}
                  href="/admin/rooms"
                  className={`p-4 rounded-lg border text-center transition-colors hover:border-primary
                    ${room.status === "available" ? "bg-success/10 border-success/30" : ""}
                    ${room.status === "occupied" ? "bg-primary/10 border-primary/30" : ""}
                    ${room.status === "maintenance" ? "bg-warning/10 border-warning/30" : ""}`}
                >
                  <p className="font-bold text-lg">{room.room_number}</p>
                  <p className="text-xs text-muted-foreground mt-1">
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