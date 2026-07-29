//tenant/move-out/page.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import {
  Plus,
  LogOut,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from "lucide-react";
import { moveOutAPI } from "@/lib/api/moveOut.api";
import { contractAPI } from "@/lib/api/contract.api";
import { useLanguage } from "@/context/language-context";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MoveOutRequest {
  request_id: number;
  move_out_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  room_number: string;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const MONTHS_TH = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ── Upgraded DatePickerField (เปิดลงล่างเสมอ + ล็อกวันที่ห้ามเลือก) ─────────────

function DatePickerField({
  id,
  value,
  onChange,
  language,
  required,
  placeholder,
  minDate,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  language: string;
  required?: boolean;
  placeholder?: string;
  minDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(
    value
      ? new Date(value + "T00:00:00")
      : minDate
        ? new Date(minDate + "T00:00:00")
        : new Date(),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setViewDate(new Date(value + "T00:00:00"));
  }, [value]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const months = language === "th" ? MONTHS_TH : MONTHS_EN;
  const days = language === "th" ? DAYS_TH : DAYS_EN;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const displayYear = language === "th" ? year + 543 : year;
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selected = value ? new Date(value + "T00:00:00") : null;

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isSelected = (day: number) =>
    !!selected &&
    selected.getFullYear() === year &&
    selected.getMonth() === month &&
    selected.getDate() === day;

  const isToday = (day: number) => {
    const now = new Date();
    return (
      now.getFullYear() === year &&
      now.getMonth() === month &&
      now.getDate() === day
    );
  };

  // 💡 ไม่ล็อกวันที่ในปฏิทินอีกต่อไป — ผู้เช่าเลือกวันไหนก็ได้ (แม้ไม่ครบ 30 วัน)
  // เพราะระบบจะคำนวณและแจ้งเตือนค่าปรับให้เห็นแทน ไม่ใช่บล็อกไม่ให้เลือก
  const isDisabled = (_day: number) => false;

  const label = value
    ? new Date(value + "T00:00:00").toLocaleDateString(
        language === "th" ? "th-TH" : "en-US",
        { year: "numeric", month: "short", day: "numeric" },
      )
    : (placeholder ??
      (language === "th" ? "เลือกวันที่..." : "Select date..."));

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus:ring-2 focus:ring-primary/50 hover:bg-muted/40 transition-colors"
      >
        <span
          className={
            value ? "text-foreground font-medium" : "text-muted-foreground"
          }
        >
          {label}
        </span>
        <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {required && (
        <input
          tabIndex={-1}
          value={value}
          required
          onChange={() => {}}
          className="sr-only"
        />
      )}

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-[9999] w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between mb-2 pb-2 border-b">
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">
              {months[month]} {displayYear}
            </span>
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1 text-center text-xs font-medium text-muted-foreground">
            {days.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (day === null) return <div key={idx} />;
              const disabled = isDisabled(day);
              const beforeMin = minDate
                ? toISODate(new Date(year, month, day)) < minDate
                : false;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (!disabled) {
                      onChange(toISODate(new Date(year, month, day)));
                      setOpen(false);
                    }
                  }}
                  className={`h-8 w-8 rounded-md text-sm font-normal transition-colors flex items-center justify-center ${
                    isSelected(day)
                      ? "bg-primary text-primary-foreground font-semibold hover:bg-primary"
                      : isToday(day)
                        ? "border border-primary text-primary hover:bg-muted"
                        : beforeMin
                          ? "text-destructive/60 hover:bg-destructive/10"
                          : "hover:bg-muted text-foreground"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {minDate && (
            <div className="mt-2 pt-2 border-t text-[11px] text-muted-foreground text-center">
              {language === "th"
                ? "* วันที่แสดงสีแดงคือแจ้งไม่ครบ 30 วัน จะถูกริบเงินประกัน"
                : "* Dates in red are less than 30 days notice — deposit will be forfeited"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function MoveOutPage() {
  const { t, language } = useLanguage();
  const [requests, setRequests] = useState<MoveOutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ moveOutDate: "", reason: "" });

  // ── ยอดเงินประกันจากสัญญาเช่าจริง (ดึงจาก contract API) ──────────────────
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const [loadingContract, setLoadingContract] = useState(true);

  useEffect(() => {
    contractAPI
      .getMyContract()
      .then((r) => {
        const contract = r.data ?? r;
        const amount = Number(contract?.deposit_amount ?? 0);
        setDepositAmount(Number.isFinite(amount) ? amount : 0);
      })
      .catch(() => setDepositAmount(0))
      .finally(() => setLoadingContract(false));
  }, []);

  // วันที่เร็วที่สุดที่แจ้งย้ายออกได้แบบไม่โดนค่าปรับ (อย่างน้อย 30 วัน)
  const minMoveOutDate = toISODate(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  );

  // ── คำนวณค่าปรับ/เงินประกันคืนโดยประมาณ ตามข้อ 13.2.6 ────────────────────
  // นโยบายปัจจุบัน: แจ้งล่วงหน้าไม่ครบ 30 วัน → ริบเงินประกันทั้งหมด (100%)
  // ตัวเลขนี้เป็นการประมาณการเบื้องต้นเท่านั้น ยอดจริงต้องรอแอดมินตรวจสอบ
  // มิเตอร์น้ำ-ไฟและสภาพห้องตอนย้ายออกอีกครั้ง
  const daysNotice = formData.moveOutDate
    ? Math.ceil(
        (new Date(formData.moveOutDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  const isLateNotice = daysNotice !== null && daysNotice < 30;
  const estimatedRefund = isLateNotice ? 0 : (depositAmount ?? 0);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const fmtBaht = (n: number) =>
    n.toLocaleString(language === "th" ? "th-TH" : "en-US");

  const statusConfig = {
    pending: {
      label: t("status.pending"),
      icon: Clock,
      color: "text-yellow-500",
    },
    approved: {
      label: t("status.approved"),
      icon: CheckCircle,
      color: "text-green-500",
    },
    rejected: {
      label: t("status.rejected"),
      icon: XCircle,
      color: "text-destructive",
    },
  };

  const fetchRequests = () => {
    moveOutAPI
      .getAll()
      .then((r) => setRequests(r.data ?? []))
      .catch((err) => {
        if (err?.response?.status !== 404) {
          toast.error(t("moveout.loadError"));
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const hasPending = requests.some((r) => r.status === "pending");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.moveOutDate || !formData.reason.trim()) {
      toast.error(t("settings.errorFillAll"));
      return;
    }
    // 💡 ไม่บล็อกการส่งคำร้องอีกต่อไปแม้แจ้งไม่ครบ 30 วัน — ให้ผู้เช่าเห็นค่าปรับ
    // ล่วงหน้าแล้วตัดสินใจเอง แอดมินจะเป็นผู้พิจารณาอนุมัติ/ปฏิเสธตามปกติ
    setSubmitting(true);
    try {
      await moveOutAPI.create({
        move_out_date: formData.moveOutDate,
        reason: formData.reason.trim(),
      });
      toast.success(t("common.confirm"));
      setFormData({ moveOutDate: "", reason: "" });
      setIsDialogOpen(false);
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("moveout.rejectError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("tenant.moveout.title")}</h1>
          <p className="text-muted-foreground">
            {t("tenant.moveout.subtitle")}
          </p>
        </div>

        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            if (!open) setFormData({ moveOutDate: "", reason: "" });
            setIsDialogOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={hasPending}>
              <Plus className="h-4 w-4" />
              {hasPending
                ? t("tenant.moveout.hasPending")
                : t("moveout.request")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md overflow-visible">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LogOut className="h-5 w-5" />
                {t("moveout.request")}
              </DialogTitle>
              <DialogDescription>{t("moveout.notice30")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <FieldGroup className="space-y-4">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t("moveout.notice30")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("moveout.fine")}
                    </p>
                  </div>
                </div>

                <Field>
                  <FieldLabel htmlFor="moveOutDate">
                    {t("moveout.moveOutDate")}
                  </FieldLabel>
                  <DatePickerField
                    id="moveOutDate"
                    value={formData.moveOutDate}
                    onChange={(v) =>
                      setFormData((p) => ({ ...p, moveOutDate: v }))
                    }
                    language={language}
                    required
                    minDate={minMoveOutDate}
                  />
                </Field>

                {/* 💡 ส่วนคำนวณค่าปรับ/เงินประกันคืนโดยประมาณ (ตามข้อ 13.2.6) */}
                {formData.moveOutDate && (
                  <div
                    className={`rounded-lg border p-3 flex gap-3 ${
                      isLateNotice
                        ? "bg-destructive/10 border-destructive/30"
                        : "bg-green-500/10 border-green-500/30"
                    }`}
                  >
                    {isLateNotice ? (
                      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    ) : (
                      <Wallet className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="text-sm space-y-1">
                      {loadingContract ? (
                        <p className="text-muted-foreground flex items-center gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {language === "th"
                            ? "กำลังดึงข้อมูลเงินประกัน..."
                            : "Loading deposit info..."}
                        </p>
                      ) : isLateNotice ? (
                        <>
                          <p className="font-medium text-destructive">
                            {language === "th"
                              ? `แจ้งล่วงหน้าเพียง ${daysNotice} วัน (ต้องครบ 30 วัน)`
                              : `Only ${daysNotice} days notice (30 required)`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "th"
                              ? `เงินประกัน ฿${fmtBaht(depositAmount ?? 0)} จะถูกริบทั้งหมดเป็นค่าปรับผิดสัญญา`
                              : `The full deposit of ฿${fmtBaht(depositAmount ?? 0)} will be forfeited as a penalty`}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-green-700 dark:text-green-400">
                            {language === "th"
                              ? `แจ้งล่วงหน้า ${daysNotice} วัน ไม่มีค่าปรับ`
                              : `${daysNotice} days notice — no penalty`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "th"
                              ? `คาดว่าจะได้รับเงินประกันคืนประมาณ ฿${fmtBaht(estimatedRefund)} (ยังไม่หักค่าน้ำ-ไฟและค่าเสียหาย ซึ่งจะคำนวณจริงตอนตรวจสอบห้องวันย้ายออก)`
                              : `Estimated deposit refund: ฿${fmtBaht(estimatedRefund)} (before utility & damage deductions, finalized on move-out inspection)`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <Field>
                  <FieldLabel htmlFor="reason">
                    {t("moveout.reason")}
                  </FieldLabel>
                  <Textarea
                    id="reason"
                    placeholder={t("moveout.reason")}
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, reason: e.target.value }))
                    }
                    className="min-h-[100px] resize-none"
                    required
                  />
                </Field>
              </FieldGroup>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={submitting}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    !formData.moveOutDate ||
                    !formData.reason.trim()
                  }
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("common.submit")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: t("status.pending"),
            value: requests.filter((r) => r.status === "pending").length,
            color: "text-yellow-500",
          },
          {
            label: t("status.approved"),
            value: requests.filter((r) => r.status === "approved").length,
            color: "text-green-500",
          },
          {
            label: t("status.rejected"),
            value: requests.filter((r) => r.status === "rejected").length,
            color: "text-destructive",
          },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            {t("moveout.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <LogOut className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <p className="font-medium text-muted-foreground">
                {t("empty.noMoveOut")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("empty.noMoveOutDesc")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.created")}</TableHead>
                  <TableHead>{t("moveout.moveOutDate")}</TableHead>
                  <TableHead>{t("moveout.reason")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("common.note")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => {
                  const s = statusConfig[r.status];
                  const Icon = s.icon;
                  return (
                    <TableRow key={r.request_id}>
                      <TableCell className="text-sm">
                        {fmtDate(r.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {fmtDate(r.move_out_date)}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {r.reason}
                      </TableCell>
                      <TableCell>
                        <div
                          className={`flex items-center gap-1.5 text-sm font-medium ${s.color}`}
                        >
                          <Icon className="h-4 w-4" />
                          {s.label}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.admin_note ?? "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-500" />
            {t("common.note")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium">{t("moveout.notice30")}</span>
          </p>
          <p>
            <span className="font-medium">{t("moveout.fine")}</span>
          </p>
          <p>
            <span className="font-medium">{t("moveout.refund")}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
