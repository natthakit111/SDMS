//tenant/bills/page.tsx

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BillStatusBadge } from "@/components/common/status-badge";
import {
  Receipt,
  FileText,
  CreditCard,
  Zap,
  Droplets,
  Loader2,
  ImageIcon,
  Camera,
} from "lucide-react";
import Link from "next/link";
import { billAPI } from "@/lib/api/bill.api";
import { useLanguage } from "@/context/language-context";
import { toast } from "sonner";

interface MeterReading {
  reading_id: number;
  meter_type: "electric" | "water";
  previous_unit: number;
  current_unit: number;
  units_used: number;
  rate_per_unit: number;
  image_path: string | null;
}

interface Bill {
  bill_id: number;
  bill_month: number;
  bill_year: number;
  rent_amount: number;
  electric_amount: number;
  water_amount: number;
  other_amount: number;
  total_amount: number;
  due_date: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  room_number: string;
  meter_readings?: MeterReading[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);

const imgUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_API_URL ?? ""}/${path}`;
};

export default function TenantBillsPage() {
  const { t, language } = useLanguage();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  useEffect(() => {
    billAPI
      .getMyBills()
      .then((r) => setBills(r.data ?? r ?? []))
      .catch((err) => {
        if (err?.response?.status !== 404) {
          toast.error(t("common.noData"));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleViewBill = async (bill: Bill) => {
    setViewingBill(bill);
    setDetailLoading(true);
    try {
      const res = await billAPI.getById(bill.bill_id);
      const detail = res?.data ?? res;

      const meter_readings: MeterReading[] = [];
      if (detail.elec_current != null) {
        meter_readings.push({
          reading_id: 0,
          meter_type: "electric",
          previous_unit: Number(detail.elec_previous ?? 0),
          current_unit: Number(detail.elec_current),
          units_used: Number(detail.elec_units ?? 0),
          rate_per_unit: Number(detail.elec_rate ?? 0),
          image_path: detail.elec_image ?? null,
        });
      }
      if (detail.water_current != null) {
        meter_readings.push({
          reading_id: 0,
          meter_type: "water",
          previous_unit: Number(detail.water_previous ?? 0),
          current_unit: Number(detail.water_current),
          units_used: Number(detail.water_units ?? 0),
          rate_per_unit: Number(detail.water_rate ?? 0),
          image_path: detail.water_image ?? null,
        });
      }

      setViewingBill({ ...bill, ...detail, meter_readings });
    } catch {
      // ใช้ข้อมูลเดิมถ้าโหลดไม่ได้
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = bills.filter(
    (b) => statusFilter === "all" || b.status === statusFilter,
  );

  const elecReading = viewingBill?.meter_readings?.find(
    (r) => r.meter_type === "electric",
  );
  const waterReading = viewingBill?.meter_readings?.find(
    (r) => r.meter_type === "water",
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("tenant.bills.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("tenant.bills.subtitle")}
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t("common.all")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="pending">{t("status.pending")}</SelectItem>
            <SelectItem value="paid">{t("status.paid")}</SelectItem>
            <SelectItem value="overdue">{t("status.overdue")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bill List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t("common.noData")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((bill) => (
            <Card
              key={bill.bill_id}
              className={
                bill.status === "overdue" ? "border-destructive/50" : ""
              }
            >
              <CardContent className="p-4 sm:p-6">
                {/* ── Top row: ไอคอน + เดือน/วันครบกำหนด (+ จำนวนเงินบน desktop) ── */}
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-lg shrink-0 ${
                      bill.status === "paid"
                        ? "bg-green-500/20"
                        : bill.status === "overdue"
                          ? "bg-destructive/20"
                          : "bg-yellow-500/20"
                    }`}
                  >
                    <Receipt
                      className={`h-6 w-6 ${
                        bill.status === "paid"
                          ? "text-green-500"
                          : bill.status === "overdue"
                            ? "text-destructive"
                            : "text-yellow-600"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-lg truncate">
                      {t(`month.${bill.bill_month}`)} {bill.bill_year}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("bills.dueDate")} {fmtDate(bill.due_date)}
                    </p>
                  </div>
                  {/* จำนวนเงิน + badge — โชว์ในแถวนี้เฉพาะ sm ขึ้นไป */}
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="text-2xl font-bold">
                      {fmt(bill.total_amount)}
                    </p>
                    <BillStatusBadge status={bill.status} />
                  </div>
                </div>

                {/* ── จำนวนเงิน + badge บนมือถือ: แยกเป็นแถวของตัวเอง ไม่บีบกับปุ่ม ── */}
                <div className="flex sm:hidden items-center justify-between mt-4">
                  <p className="text-2xl font-bold">{fmt(bill.total_amount)}</p>
                  <BillStatusBadge status={bill.status} />
                </div>

                {/* ── ปุ่ม action: เต็มความกว้างบนมือถือ, ปกติบน desktop ── */}
                <div className="flex gap-2 mt-4 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none min-h-[40px]"
                    onClick={() => handleViewBill(bill)}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    {t("common.view")}
                  </Button>
                  {(bill.status === "pending" || bill.status === "overdue") && (
                    <Link
                      href={`/tenant/payment?bill=${bill.bill_id}`}
                      className="flex-1 sm:flex-none"
                    >
                      <Button size="sm" className="w-full min-h-[40px]">
                        <CreditCard className="h-4 w-4 mr-1" />
                        {t("tenant.payNow")}
                      </Button>
                    </Link>
                  )}
                </div>

                {/* Bill breakdown */}
                <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">
                      {t("bills.rentAmount")}:
                    </span>
                    <span className="font-medium">{fmt(bill.rent_amount)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-muted-foreground">
                      {t("bills.electricAmount")}:
                    </span>
                    <span className="font-medium">
                      {fmt(bill.electric_amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <span className="text-muted-foreground">
                      {t("bills.waterAmount")}:
                    </span>
                    <span className="font-medium">
                      {fmt(bill.water_amount)}
                    </span>
                  </div>
                  {bill.other_amount > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">
                        {t("bills.otherAmount")}:
                      </span>
                      <span className="font-medium">
                        {fmt(bill.other_amount)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!viewingBill}
        onOpenChange={(open) => !open && setViewingBill(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("tenant.bills.invoice")}
            </DialogTitle>
          </DialogHeader>
          {viewingBill && (
            <div className="space-y-4">
              {/* Room + Month */}
              <div className="flex justify-between items-center pb-4 border-b gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-lg truncate">
                    {t("rooms.roomNumber")} {viewingBill.room_number}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(`month.${viewingBill.bill_month}`)}{" "}
                    {viewingBill.bill_year}
                  </p>
                </div>
                <BillStatusBadge status={viewingBill.status} />
              </div>

              {/* Breakdown */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t("bills.rentAmount")}
                  </span>
                  <span className="font-medium shrink-0">
                    {fmt(viewingBill.rent_amount)}
                  </span>
                </div>

                {/* Electric — label/amount แถวเดียว, รายละเอียดมิเตอร์แยกบรรทัดล่าง */}
                <div className="space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="flex items-center gap-1 text-muted-foreground min-w-0">
                      <Zap className="h-3 w-3 text-yellow-500 shrink-0" />
                      {t("bills.electricAmount")}
                    </span>
                    <span className="font-medium shrink-0">
                      {fmt(viewingBill.electric_amount)}
                    </span>
                  </div>
                  {elecReading && (
                    <p className="text-xs text-muted-foreground pl-4">
                      {elecReading.previous_unit} → {elecReading.current_unit} ={" "}
                      {elecReading.units_used} {t("meters.used")} × ฿
                      {elecReading.rate_per_unit}
                    </p>
                  )}
                </div>

                {/* Water — เหมือนกัน */}
                <div className="space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="flex items-center gap-1 text-muted-foreground min-w-0">
                      <Droplets className="h-3 w-3 text-blue-500 shrink-0" />
                      {t("bills.waterAmount")}
                    </span>
                    <span className="font-medium shrink-0">
                      {fmt(viewingBill.water_amount)}
                    </span>
                  </div>
                  {waterReading && (
                    <p className="text-xs text-muted-foreground pl-4">
                      {waterReading.previous_unit} → {waterReading.current_unit}{" "}
                      = {waterReading.units_used} {t("meters.used")} × ฿
                      {waterReading.rate_per_unit}
                    </p>
                  )}
                </div>

                {viewingBill.other_amount > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      {t("bills.otherAmount")}
                    </span>
                    <span className="font-medium shrink-0">
                      {fmt(viewingBill.other_amount)}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Total */}
              <div className="flex justify-between pt-4 border-t text-xl font-bold">
                <span>{t("common.total")}</span>
                <span className="text-primary">
                  {fmt(viewingBill.total_amount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("bills.dueDate")}
                </span>
                <span>{fmtDate(viewingBill.due_date)}</span>
              </div>

              {/* Meter Images */}
              {detailLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : elecReading?.image_path || waterReading?.image_path ? (
                <div className="pt-4 border-t space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    {t("meters.image")}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Electric meter image */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Zap className="h-3 w-3 text-yellow-500" />
                        {t("meters.electric")}
                      </p>
                      {elecReading?.image_path ? (
                        <a
                          href={imgUrl(elecReading.image_path) ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={imgUrl(elecReading.image_path) ?? ""}
                            alt={t("meters.electric")}
                            className="w-full h-32 object-cover rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                          />
                        </a>
                      ) : (
                        <div className="flex items-center justify-center h-32 bg-muted rounded-lg">
                          <div className="text-center text-muted-foreground">
                            <ImageIcon className="h-6 w-6 mx-auto mb-1 opacity-50" />
                            <p className="text-xs">{t("common.noData")}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Water meter image */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Droplets className="h-3 w-3 text-blue-500" />
                        {t("meters.water")}
                      </p>
                      {waterReading?.image_path ? (
                        <a
                          href={imgUrl(waterReading.image_path) ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={imgUrl(waterReading.image_path) ?? ""}
                            alt={t("meters.water")}
                            className="w-full h-32 object-cover rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                          />
                        </a>
                      ) : (
                        <div className="flex items-center justify-center h-32 bg-muted rounded-lg">
                          <div className="text-center text-muted-foreground">
                            <ImageIcon className="h-6 w-6 mx-auto mb-1 opacity-50" />
                            <p className="text-xs">{t("common.noData")}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Pay button */}
              {(viewingBill.status === "pending" ||
                viewingBill.status === "overdue") && (
                <Link
                  href={`/tenant/payment?bill=${viewingBill.bill_id}`}
                  className="block"
                >
                  <Button className="w-full mt-2">
                    <CreditCard className="h-4 w-4 mr-2" />
                    {t("tenant.payNow")}
                  </Button>
                </Link>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
