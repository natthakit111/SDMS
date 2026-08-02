//admin/bills/page.tsx

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { BillStatusBadge } from "@/components/common/status-badge";
import {
  Plus,
  Search,
  Receipt,
  Eye,
  FileText,
  XCircle,
  Loader2,
  Zap,
  Droplets,
  Camera,
  ImageIcon,
  Download,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { billAPI } from "@/lib/api/bill.api";
import { roomAPI } from "@/lib/api/room.api";
import { useLanguage } from "@/context/language-context";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  contract_id: number;
  room_id: number;
  room_number: string;
  tenant_name: string;
  tenant_id: number;
  bill_month: number;
  bill_year: number;
  rent_amount: number;
  electric_amount: number;
  water_amount: number;
  other_amount: number;
  total_amount: number;
  due_date: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  qr_payload: string | null;
  meter_readings?: MeterReading[];
}

interface Room {
  room_id: number;
  room_number: string;
  status: string;
  tenant_name?: string;
}

interface FormData {
  room_id: string;
  month: string;
  year: string;
  other_amount: string;
  note: string; // 💡 เพิ่มฟิลด์หมายเหตุ
  due_date: string;
}

const emptyForm: FormData = {
  room_id: "",
  month: String(new Date().getMonth() + 1),
  year: String(new Date().getFullYear()),
  other_amount: "0",
  note: "", // 💡 ค่าเริ่มต้น
  due_date: "",
};

const formatCurrency = (n: number) =>
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

// ── Custom bilingual date picker ────────────────────────────────────────────

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

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function DatePickerField({
  id,
  value,
  onChange,
  language,
  required,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  language: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(
    value ? new Date(value + "T00:00:00") : new Date(),
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

  const label = value
    ? new Date(value + "T00:00:00").toLocaleDateString(
        language === "th" ? "th-TH" : "en-US",
        { year: "numeric", month: "short", day: "numeric" },
      )
    : (placeholder ?? (language === "th" ? "เลือกวันที่" : "Select date"));

  return (
    <div className="relative" ref={containerRef}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus:ring-2 focus:ring-ring/50"
      >
        <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className={value ? "" : "text-muted-foreground"}>{label}</span>
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
        <div className="absolute left-0 bottom-full mb-2 z-[100] w-64 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg sm:bottom-auto sm:top-full sm:mt-2">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              className="p-1 rounded hover:bg-muted"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">
              {months[month]} {displayYear}
            </span>
            <button
              type="button"
              className="p-1 rounded hover:bg-muted"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1 text-center text-xs text-muted-foreground">
            {days.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) =>
              day === null ? (
                <div key={idx} />
              ) : (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onChange(toISODate(new Date(year, month, day)));
                    setOpen(false);
                  }}
                  className={`h-8 w-8 rounded-md text-sm hover:bg-muted transition-colors ${
                    isSelected(day)
                      ? "bg-primary text-primary-foreground hover:bg-primary"
                      : isToday(day)
                        ? "border border-primary"
                        : ""
                  }`}
                >
                  {day}
                </button>
              ),
            )}
          </div>

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                const today = new Date();
                setViewDate(today);
                onChange(toISODate(today));
                setOpen(false);
              }}
            >
              {language === "th" ? "วันนี้" : "Today"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function BillsPage() {
  const { t, language } = useLanguage();
  const [bills, setBills] = useState<Bill[]>([]);
  const [occupiedRooms, setOccupiedRooms] = useState<Room[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [exportingId, setExportingId] = useState<number | null>(null);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  // ── Fetch bills ───────────────────────────────────────────────────────────
  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await billAPI.getAll(params);
      setBills(res.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("common.noData"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchOccupiedRooms = async () => {
    try {
      const res = await roomAPI.getAll({ status: "occupied" });
      setOccupiedRooms(res.data ?? []);
    } catch {}
  };

  const fetchAvailableRooms = useCallback(
    async (month: string, year: string) => {
      try {
        const res = await billAPI.getAvailableRooms({ month, year });
        setAvailableRooms(res.data ?? []);
      } catch {
        setAvailableRooms([]);
      }
    },
    [],
  );

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);
  useEffect(() => {
    fetchOccupiedRooms();
  }, []);

  useEffect(() => {
    if (isAddDialogOpen) {
      fetchAvailableRooms(formData.month, formData.year);
    }
  }, [isAddDialogOpen, formData.month, formData.year, fetchAvailableRooms]);

  // ── View bill ─────────────────────────────────────────────────────────────
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

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredBills = bills.filter((b) => {
    const q = searchQuery.toLowerCase();
    return (
      b.room_number?.toLowerCase().includes(q) ||
      b.tenant_name?.toLowerCase().includes(q)
    );
  });

  // ── Generate bill ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await billAPI.generate({
        room_id: parseInt(formData.room_id),
        month: parseInt(formData.month),
        year: parseInt(formData.year),
        other_amount: parseFloat(formData.other_amount) || 0,
        note: formData.note || undefined, // 💡 ส่งหมายเหตุไปให้หลังบ้าน
        due_date: formData.due_date || undefined,
      });
      toast.success(t("bills.generate"));
      resetForm();
      fetchBills();
    } catch (err: any) {
      const data = err?.response?.data;
      const errorCode: string | undefined = data?.error_code;
      const errorMsg = errorCode
        ? t(errorCode)
        : (data?.message ?? t("common.error"));
      const isMeterError = errorCode === "bills.error.noWaterMeter";
      toast.error(errorMsg, {
        description: isMeterError ? t("bills.error.meterHint") : undefined,
        duration: 6000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cancel bill ───────────────────────────────────────────────────────────
  const handleCancel = async (bill: Bill) => {
    if (
      !confirm(
        `${t("bills.cancelBill")} ${t("rooms.roomNumber")} ${bill.room_number} ${t(`month.${bill.bill_month}`)} ${bill.bill_year}?`,
      )
    )
      return;
    try {
      await billAPI.cancel(bill.bill_id);
      toast.success(t("bills.cancelBill"));
      fetchBills();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("common.noData"));
    }
  };

  // ── Export invoice (PDF) ─────────────────────────────────────────────────
  const handleExportInvoice = async (bill: Bill) => {
    setExportingId(bill.bill_id);
    try {
      await billAPI.exportInvoice(
        bill.bill_id,
        `invoice-${bill.room_number}-${bill.bill_month}-${bill.bill_year}.pdf`,
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("common.error"));
    } finally {
      setExportingId(null);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setIsAddDialogOpen(false);
  };

  const currentYear = new Date().getFullYear();
  const elecReading = viewingBill?.meter_readings?.find(
    (r) => r.meter_type === "electric",
  );
  const waterReading = viewingBill?.meter_readings?.find(
    (r) => r.meter_type === "water",
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("bills.title")}</h1>
          <p className="text-muted-foreground">{t("bills.subtitle")}</p>
        </div>

        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            if (!open) resetForm();
            setIsAddDialogOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("bills.generate")}
            </Button>
          </DialogTrigger>
          {/* 💡 ขยายขนาดหน้าต่างให้กว้างขึ้นเป็น max-w-2xl */}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("bills.generate")}</DialogTitle>
              <DialogDescription>{t("bills.subtitle")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel>
                    {t("rooms.roomNumber")} ({t("status.occupied")})
                  </FieldLabel>
                  <Select
                    value={formData.room_id}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, room_id: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("rooms.searchPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRooms.map((r) => (
                        <SelectItem key={r.room_id} value={String(r.room_id)}>
                          {t("rooms.roomNumber")} {r.room_number}
                          {r.tenant_name ? ` (${r.tenant_name})` : ""}
                        </SelectItem>
                      ))}
                      {availableRooms.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {language === "th"
                            ? "ไม่มีห้องที่พร้อมออกบิล"
                            : "No rooms available"}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>{t("bills.month")}</FieldLabel>
                    <Select
                      value={formData.month}
                      onValueChange={(v) =>
                        setFormData((p) => ({ ...p, month: v, room_id: "" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (m) => (
                            <SelectItem key={m} value={String(m)}>
                              {t(`month.${m}`)}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>{t("bills.year")}</FieldLabel>
                    <Select
                      value={formData.year}
                      onValueChange={(v) =>
                        setFormData((p) => ({ ...p, year: v, room_id: "" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[currentYear, currentYear - 1].map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {/* 💡 เพิ่มช่องหมายเหตุค่าอื่นๆ ให้อยู่บรรทัดเดียวกับจำนวนเงิน */}
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="other_amount">
                      {t("bills.otherAmount")}
                    </FieldLabel>
                    <Input
                      id="other_amount"
                      type="number"
                      value={formData.other_amount}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          other_amount: e.target.value,
                        }))
                      }
                      placeholder="0"
                      min="0"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="note">
                      {language === "th"
                        ? "รายละเอียดค่าอื่นๆ"
                        : "Remark for other fees"}
                    </FieldLabel>
                    <Input
                      id="note"
                      type="text"
                      value={formData.note}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          note: e.target.value,
                        }))
                      }
                      placeholder={
                        language === "th"
                          ? "เช่น ค่าปรับ, ค่าทำความสะอาด"
                          : "e.g., Fine, Cleaning fee"
                      }
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="due_date">
                    {t("bills.dueDate")}
                  </FieldLabel>
                  {/* 💡 ใช้ DatePicker ตัวใหม่ */}
                  <DatePickerField
                    id="due_date"
                    value={formData.due_date}
                    onChange={(v) =>
                      setFormData((p) => ({ ...p, due_date: v }))
                    }
                    language={language}
                    required
                  />
                </Field>

                {/* 💡 กล่องแจ้งเตือนการดึงข้อมูลอัตโนมัติ */}
                <div className="bg-muted/50 p-4 rounded-lg border border-border/50 text-sm mt-2">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">
                        {language === "th"
                          ? "การคำนวณบิลอัตโนมัติ"
                          : "Automatic Bill Calculation"}
                      </p>
                      <p className="text-muted-foreground mt-1">
                        {language === "th"
                          ? "ระบบจะทำการดึง ค่าเช่าห้อง จากสัญญาเช่า และดึง ค่าน้ำ-ค่าไฟ จากหน้าที่บันทึกมิเตอร์ของเดือนที่เลือก มารวมยอดให้อัตโนมัติ"
                          : "The system will automatically fetch Room Rent from the contract and Water/Electric usage from the meter records for the selected month."}
                      </p>
                    </div>
                  </div>
                </div>
              </FieldGroup>
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !formData.room_id}
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("bills.generate")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("bills.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
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
                <SelectItem value="cancelled">
                  {t("status.cancelled")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {t("bills.list")}
          </CardTitle>
          <CardDescription>
            {t("common.all")} {filteredBills.length} {t("bills.list")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("rooms.roomNumber")}</TableHead>
                  <TableHead>{t("tenants.title")}</TableHead>
                  <TableHead>
                    {t("bills.month")}/{t("bills.year")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("bills.totalAmount")}
                  </TableHead>
                  <TableHead>{t("bills.dueDate")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.map((bill) => (
                  <TableRow key={bill.bill_id}>
                    <TableCell className="font-medium">
                      {bill.room_number}
                    </TableCell>
                    <TableCell>{bill.tenant_name}</TableCell>
                    <TableCell>
                      {t(`month.${bill.bill_month}`)} {bill.bill_year}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(bill.total_amount)}
                    </TableCell>
                    <TableCell>{formatDate(bill.due_date)}</TableCell>
                    <TableCell>
                      <BillStatusBadge status={bill.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewBill(bill)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleExportInvoice(bill)}
                          disabled={exportingId === bill.bill_id}
                          title={t("bills.exportInvoice") ?? "Export invoice"}
                        >
                          {exportingId === bill.bill_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        {(bill.status === "pending" ||
                          bill.status === "overdue") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCancel(bill)}
                            className="text-destructive hover:text-destructive"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredBills.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {t("common.noData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Bill Dialog */}
      <Dialog
        open={!!viewingBill}
        onOpenChange={(open) => !open && setViewingBill(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("bills.detail")}
            </DialogTitle>
          </DialogHeader>
          {viewingBill && (
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b">
                <div>
                  <p className="font-medium">
                    {t("rooms.roomNumber")} {viewingBill.room_number}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {viewingBill.tenant_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {t(`month.${viewingBill.bill_month}`)}{" "}
                    {viewingBill.bill_year}
                  </p>
                  <BillStatusBadge status={viewingBill.status} />
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("bills.rentAmount")}
                  </span>
                  <span>{formatCurrency(viewingBill.rent_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    {t("bills.electricAmount")}
                    {elecReading && (
                      <span className="text-xs ml-1">
                        ({elecReading.previous_unit} →{" "}
                        {elecReading.current_unit} = {elecReading.units_used}{" "}
                        {t("meters.used")} × ฿{elecReading.rate_per_unit})
                      </span>
                    )}
                  </span>
                  <span>{formatCurrency(viewingBill.electric_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Droplets className="h-3 w-3 text-blue-500" />
                    {t("bills.waterAmount")}
                    {waterReading && (
                      <span className="text-xs ml-1">
                        ({waterReading.previous_unit} →{" "}
                        {waterReading.current_unit} = {waterReading.units_used}{" "}
                        {t("meters.used")} × ฿{waterReading.rate_per_unit})
                      </span>
                    )}
                  </span>
                  <span>{formatCurrency(viewingBill.water_amount)}</span>
                </div>
                {viewingBill.other_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("bills.otherAmount")}
                    </span>
                    <span>{formatCurrency(viewingBill.other_amount)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t font-bold text-lg">
                <span>{t("common.total")}</span>
                <span>{formatCurrency(viewingBill.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("bills.dueDate")}
                </span>
                <span>{formatDate(viewingBill.due_date)}</span>
              </div>

              {/* Export invoice from detail dialog too */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleExportInvoice(viewingBill)}
                  disabled={exportingId === viewingBill.bill_id}
                >
                  {exportingId === viewingBill.bill_id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {t("bills.exportInvoice") ?? "Export Invoice PDF"}
                </Button>
              </div>

              {/* Meter images */}
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
