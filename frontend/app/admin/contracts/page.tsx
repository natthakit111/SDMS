//rooms/page.tsx -> contracts/page.tsx

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  FileText,
  Plus,
  Eye,
  XCircle,
  Loader2,
  Search,
  RefreshCw,
  LogOut,
  CreditCard,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Paperclip,
} from "lucide-react";
import { contractAPI } from "@/lib/api/contract.api";
import { tenantAPI } from "@/lib/api/tenant.api";
import { roomAPI } from "@/lib/api/room.api";
import { toast } from "sonner";
import { useLanguage } from "@/context/language-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contract {
  contract_id: number;
  tenant_id: number;
  room_id: number;
  tenant_name: string;
  tenant_id_card?: string;
  room_number: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  deposit_amount: number;
  status: "active" | "expired" | "terminated";
  note: string | null;
  contract_file: string | null;
  // ── เงินประกัน (join จาก deposits table, null ถ้ายังไม่มี record) ─────
  deposit_status: "holding" | "refunded" | null;
  deposit_refund_amount: number | null;
  deposit_deduction: number | null;
  deposit_deduction_note: string | null;
  deposit_refund_date: string | null;
}

interface FormData {
  tenant_id: string;
  tenant_id_card: string;
  room_id: string;
  start_date: string;
  end_date: string;
  rent_amount: string;
  deposit_amount: string;
  note: string;
}

interface RenewFormData {
  end_date: string;
  rent_amount: string;
}

interface CheckoutFormData {
  checkout_date: string;
}

const emptyForm: FormData = {
  tenant_id: "",
  tenant_id_card: "",
  room_id: "",
  start_date: "",
  end_date: "",
  rent_amount: "",
  deposit_amount: "",
  note: "",
};

const emptyRenewForm: RenewFormData = {
  end_date: "",
  rent_amount: "",
};

const emptyCheckoutForm: CheckoutFormData = {
  checkout_date: "",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-500",
  expired: "bg-red-500/10 text-red-500",
  terminated: "bg-muted text-muted-foreground",
};

const CONTRACT_FILE_ACCEPT = ".pdf,.doc,.docx";
const CONTRACT_FILE_MAX_MB = 10;

// ── Custom bilingual date picker ────────────────────────────────────────────
// Native <input type="date"> follows the OS/browser language and ignores the
// app's `language` state entirely — that's why the calendar could never be
// forced into Thai or English. This component renders its own calendar UI so
// month/day names and the year (พ.ศ. vs ค.ศ.) always match `language`.

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
  dropDirection = "down",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  language: string;
  required?: boolean;
  placeholder?: string;
  dropDirection?: "up" | "down";
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

      {/* hidden input keeps native `required` form validation working */}
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
        <div className={`absolute left-0 z-[100] w-64 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg ${dropDirection === "up"
              ? "bottom-full mb-2"
              : "top-full mt-1" // ← เปลี่ยนให้เด้งลงล่างเป็นหลัก
          }`}
        >
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

export default function ContractsPage() {
  const { t, language } = useLanguage();

  const formatDate = (d: string) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString(
      language === "th" ? "th-TH" : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      },
    );
  };

  const formatCurrency = (n: number) =>
    n.toLocaleString("th-TH") + " " + t("contracts.baht");

  const depositStatusBadge = (c: Contract, language: string) => {
    if (Number(c.deposit_amount) <= 0) return null; // ไม่มีเงินประกันเลย ไม่ต้องโชว์

    if (c.deposit_status === "refunded") {
      const deduction = Number(c.deposit_deduction || 0);
      if (deduction > 0) {
        return {
          label:
            language === "th"
              ? `คืนบางส่วน ${Number(c.deposit_refund_amount).toLocaleString("th-TH")} (หัก ${deduction.toLocaleString("th-TH")})`
              : `Partially refunded ${Number(c.deposit_refund_amount).toLocaleString("th-TH")} (deducted ${deduction.toLocaleString("th-TH")})`,
          className: "bg-orange-500/10 text-orange-600",
        };
      }
      return {
        label:
          language === "th"
            ? `คืนเงินประกันแล้ว ${Number(c.deposit_refund_amount).toLocaleString("th-TH")}`
            : `Refunded ${Number(c.deposit_refund_amount).toLocaleString("th-TH")}`,
        className: "bg-green-500/10 text-green-600",
      };
    }

    // status = 'holding' หรือ null (ยังไม่มี record — สัญญาเก่าก่อนแก้บั๊ก)
    return {
      label: language === "th" ? "ถือเงินประกันไว้" : "Deposit held",
      className: "bg-yellow-500/10 text-yellow-600",
    };
  };

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  // ── Contract file (upload ตอนสร้าง / ดาวน์โหลด / แทนที่ทีหลัง) ───────────
  const [newContractFile, setNewContractFile] = useState<File | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [uploadingReplace, setUploadingReplace] = useState(false);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // ── Renew contract ──────────────────────────────────────────────────────
  const [renewingContract, setRenewingContract] = useState<Contract | null>(
    null,
  );
  const [renewForm, setRenewForm] = useState<RenewFormData>(emptyRenewForm);
  const [renewSubmitting, setRenewSubmitting] = useState(false);

  // ── Checkout / ทำเรื่องย้ายออก ───────────────────────
  const [checkingOutContract, setCheckingOutContract] =
    useState<Contract | null>(null);
  const [checkoutForm, setCheckoutForm] =
    useState<CheckoutFormData>(emptyCheckoutForm);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  // ── Fetch contracts ───────────────────────────────────────────────────────
  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus !== "all") params.status = filterStatus;
      const res = await contractAPI.getAll(params);
      setContracts(res.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("contracts.loadError"));
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  // ── Fetch tenants + available rooms for form ──────────────────────────────
  const fetchFormOptions = async () => {
    try {
      const [tRes, rRes] = await Promise.all([
        tenantAPI.getAll(),
        roomAPI.getAll({ status: "available" }),
      ]);
      setTenants(tRes.data ?? []);
      setAvailableRooms(rRes.data ?? []);
    } catch {
      /* ไม่ critical */
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);
  useEffect(() => {
    fetchFormOptions();
  }, []);

  // ── Filter client-side ────────────────────────────────────────────────────
  const filteredContracts = contracts.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.tenant_name?.toLowerCase().includes(q) ||
      c.room_number?.toLowerCase().includes(q) ||
      String(c.contract_id).includes(q)
    );
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  // เดิม
  const totalDeposit = contracts
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + Number(c.deposit_amount), 0);

  // เพิ่มอีกตัวสำหรับยอดที่คืนไปแล้วทั้งหมด (ใช้ track ได้ว่าคืนไปเท่าไหร่)
  const totalRefunded = contracts
    .filter((c) => c.deposit_status === "refunded")
    .reduce((sum, c) => sum + Number(c.deposit_refund_amount || 0), 0);

  // ── Validate a selected contract file (ใช้ทั้งตอนสร้างและตอนแทนที่) ──────
  const validateContractFile = (file: File): boolean => {
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
    if (!CONTRACT_FILE_ACCEPT.split(",").includes(ext)) {
      toast.error(
        language === "th"
          ? "รองรับเฉพาะไฟล์ PDF หรือ Word (.pdf, .doc, .docx) เท่านั้น"
          : "Only PDF or Word files (.pdf, .doc, .docx) are supported",
      );
      return false;
    }
    if (file.size > CONTRACT_FILE_MAX_MB * 1024 * 1024) {
      toast.error(
        language === "th"
          ? `ไฟล์ต้องมีขนาดไม่เกิน ${CONTRACT_FILE_MAX_MB}MB`
          : `File must be under ${CONTRACT_FILE_MAX_MB}MB`,
      );
      return false;
    }
    return true;
  };

  // ── Create contract (+ อัปโหลดไฟล์ผูกกับ contract ที่สร้างใหม่ ถ้ามีการแนบ) ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const idCard = formData.tenant_id_card?.trim();
    if (!idCard) {
      toast.error(
        language === "th"
          ? "กรุณากรอกเลขประจำตัวประชาชนหรือพาสปอร์ต"
          : "ID Card / Passport is required",
      );
      setSubmitting(false);
      return;
    }
    const isNumericOnly = /^\d+$/.test(idCard);
    if (isNumericOnly && idCard.length !== 13) {
      toast.error(
        language === "th"
          ? "เลขประจำตัวประชาชนต้องมี 13 หลัก"
          : "ID Card must be 13 digits",
      );
      setSubmitting(false);
      return;
    }

    try {
      const created = await contractAPI.create({
        tenant_id: parseInt(formData.tenant_id),
        room_id: parseInt(formData.room_id),
        start_date: formData.start_date,
        end_date: formData.end_date,
        rent_amount: formData.rent_amount
          ? parseFloat(formData.rent_amount)
          : undefined,
        deposit_amount: formData.deposit_amount
          ? parseFloat(formData.deposit_amount)
          : undefined,
        note: formData.note || undefined,
      });

      const newContractId = created?.data?.contract_id;

      // ถ้า admin แนบไฟล์สัญญามาด้วย → อัปโหลดผูกกับ contract ที่เพิ่งสร้างทันที
      if (newContractId && newContractFile) {
        try {
          await contractAPI.uploadFile(newContractId, newContractFile);
        } catch (uploadErr: any) {
          // สัญญาสร้างสำเร็จแล้ว แต่แนบไฟล์ไม่สำเร็จ — แจ้งเตือนแยก ไม่ rollback สัญญา
          toast.error(
            language === "th"
              ? "สร้างสัญญาสำเร็จ แต่แนบไฟล์ไม่สำเร็จ กรุณาอัปโหลดไฟล์อีกครั้งภายหลัง"
              : "Contract created, but the file upload failed. Please upload it again later.",
          );
        }
      }

      toast.success(t("contracts.createSuccess"));
      resetForm();
      fetchContracts();
      fetchFormOptions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("contracts.createError"));
    } finally {
      setSubmitting(false);
    }
  };

  // ── ดาวน์โหลด/ดูไฟล์สัญญา (ใช้ได้กับทุกสัญญาที่มีไฟล์แนบ) ─────────────────
  const handleDownloadFile = async (contract: Contract) => {
    if (!contract.contract_file) return;
    setDownloadingId(contract.contract_id);
    try {
      const res = await contractAPI.downloadFile(contract.contract_id);
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const ext = contract.contract_file.split(".").pop();
      const a = document.createElement("a");
      a.href = url;
      a.download = `contract_CNT${String(contract.contract_id).padStart(3, "0")}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(
        language === "th"
          ? "ไม่สามารถดาวน์โหลดไฟล์สัญญาได้"
          : "Failed to download the contract file",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  // ── อัปโหลด/แทนที่ไฟล์สัญญา จากใน view dialog (เผื่อลืมแนบตอนสร้าง หรืออยากเปลี่ยนไฟล์) ──
  const handleReplaceFileUpload = async () => {
    if (!viewingContract || !replaceFile) return;
    if (!validateContractFile(replaceFile)) return;
    setUploadingReplace(true);
    try {
      const res = await contractAPI.uploadFile(
        viewingContract.contract_id,
        replaceFile,
      );
      toast.success(
        language === "th" ? "อัปโหลดไฟล์สัญญาสำเร็จ" : "Contract file uploaded",
      );
      const updated = res?.data as Contract | undefined;
      if (updated) setViewingContract(updated);
      setReplaceFile(null);
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
      fetchContracts();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ??
          (language === "th"
            ? "อัปโหลดไฟล์ไม่สำเร็จ"
            : "Failed to upload the file"),
      );
    } finally {
      setUploadingReplace(false);
    }
  };

  // ── Terminate contract ────────────────────────────────────────────────────
  const handleTerminate = async (contract: Contract) => {
    if (
      !confirm(
        `${t("contracts.confirmTerminate")} ${contract.tenant_name} ${t("contracts.confirmTerminate2")} ${contract.room_number} ${t("contracts.confirmTerminate3")}`,
      )
    )
      return;
    try {
      const res = await contractAPI.terminate(contract.contract_id);
      toast.success(res.message ?? t("contracts.terminateSuccess"));
      setViewingContract(null);
      fetchContracts();
      fetchFormOptions();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? t("contracts.terminateError"),
      );
    }
  };

  // ── Renew contract ────────────────────────────────────────────────────────
  const openRenewDialog = (contract: Contract) => {
    setRenewForm({
      end_date: "",
      rent_amount: String(contract.rent_amount ?? ""),
    });
    setRenewingContract(contract);
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingContract) return;
    setRenewSubmitting(true);
    try {
      const res = await contractAPI.renew(renewingContract.contract_id, {
        end_date: renewForm.end_date,
        rent_amount: renewForm.rent_amount
          ? parseFloat(renewForm.rent_amount)
          : undefined,
      });
      toast.success(res.message ?? t("contracts.renewSuccess"));
      setRenewingContract(null);
      setRenewForm(emptyRenewForm);
      setViewingContract(null);
      fetchContracts();
      fetchFormOptions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("contracts.renewError"));
    } finally {
      setRenewSubmitting(false);
    }
  };

  // ── Checkout ────────────────────────────────────────────────────────────
  const openCheckoutDialog = (contract: Contract) => {
    setCheckoutForm({
      checkout_date: new Date().toISOString().slice(0, 10),
    });
    setCheckingOutContract(contract);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkingOutContract) return;
    setCheckoutSubmitting(true);
    try {
      const res = await contractAPI.terminate(checkingOutContract.contract_id, {
        checkout_date: checkoutForm.checkout_date,
      });
      toast.success(res.message ?? t("contracts.checkoutSuccess"));
      setCheckingOutContract(null);
      setCheckoutForm(emptyCheckoutForm);
      setViewingContract(null);
      fetchContracts();
      fetchFormOptions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("contracts.checkoutError"));
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setNewContractFile(null);
    setIsAddDialogOpen(false);
  };

  const set =
    (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData((p) => ({ ...p, [field]: e.target.value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("contracts.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("contracts.subtitle")}
          </p>
        </div>

        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            if (!open) resetForm();
            setIsAddDialogOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t("contracts.new")}
            </Button>
          </DialogTrigger>

          {/* FIX #1: max-h + overflow-y-auto so a tall form never gets
             clipped by the viewport (this was the "หน้าจอล้น" bug) */}
          {/* เปลี่ยนเป็น max-w-2xl เพื่อให้กว้างขึ้นอีกระดับ */}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("contracts.newTitle")}</DialogTitle>
              <DialogDescription>{t("contracts.newDesc")}</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} noValidate>
              <FieldGroup>
                {/* ผู้เช่า */}
                <Field>
                  <FieldLabel>{t("contracts.tenant")}</FieldLabel>
                  <Select
                    value={formData.tenant_id}
                    onValueChange={(v) => {
                      const selectedTenant = tenants.find(
                        (tn) => String(tn.tenant_id) === v,
                      );
                      setFormData((p) => ({
                        ...p,
                        tenant_id: v,
                        // FIX #4: backend column is `id_card_number`
                        // (see TenantModel.findAll SQL: `t.*` → t.id_card_number)
                        // the old code looked for `id_card` / `national_id`,
                        // which don't exist on the row, so it was always "".
                        tenant_id_card: selectedTenant?.id_card_number || "",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("contracts.selectTenant")} />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tn) => (
                        <SelectItem
                          key={tn.tenant_id}
                          value={String(tn.tenant_id)}
                        >
                          {tn.first_name} {tn.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* เลขประจำตัวประชาชน / พาสปอร์ต */}
                <Field>
                  <FieldLabel>
                    {language === "th"
                      ? "เลขประจำตัวประชาชน / พาสปอร์ต"
                      : "ID Card / Passport"}
                  </FieldLabel>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={formData.tenant_id_card}
                      onChange={set("tenant_id_card")}
                      placeholder={
                        language === "th"
                          ? "กรอกเลขประจำตัวประชาชน"
                          : "Enter ID card number"
                      }
                      className="pl-9"
                    />
                  </div>
                </Field>

                {/* ห้อง */}
                <Field>
                  {/* FIX #2: removed the duplicated <FieldLabel> that was
                     rendered twice in a row */}
                  <FieldLabel>{t("contracts.availableRoom")}</FieldLabel>
                  <Select
                    value={formData.room_id}
                    onValueChange={(v) => {
                      const room = availableRooms.find(
                        (r) => String(r.room_id) === v,
                      );
                      setFormData((p) => ({
                        ...p,
                        room_id: v,
                        rent_amount:
                          room && room.base_rent
                            ? String(room.base_rent)
                            : p.rent_amount,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("contracts.selectRoom")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRooms.map((r) => (
                        <SelectItem key={r.room_id} value={String(r.room_id)}>
                          {t("contracts.room")} {r.room_number} —{" "}
                          {r.base_rent?.toLocaleString("th-TH")}{" "}
                          {t("contracts.perMonth")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* วันที่ — FIX #3: custom bilingual DatePickerField instead
                   of native <input type="date">, which always followed the
                   OS/browser language and could never be forced to TH/EN */}
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="start_date">
                      {t("contracts.startDate")}
                    </FieldLabel>
                    <DatePickerField
                      id="start_date"
                      value={formData.start_date}
                      onChange={(v) =>
                        setFormData((p) => ({ ...p, start_date: v }))
                      }
                      language={language}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="end_date">
                      {t("contracts.endDate")}
                    </FieldLabel>
                    <DatePickerField
                      id="end_date"
                      value={formData.end_date}
                      onChange={(v) =>
                        setFormData((p) => ({ ...p, end_date: v }))
                      }
                      language={language}
                      required
                    />
                  </Field>
                </div>

                {/* ค่าเช่า / เงินประกัน */}
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="rent_amount">
                      {t("contracts.rentAmountBaht")}
                    </FieldLabel>
                    <Input
                      id="rent_amount"
                      type="number"
                      value={formData.rent_amount}
                      onChange={set("rent_amount")}
                      placeholder={t("contracts.useRoomRent")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="deposit_amount">
                      {t("contracts.depositBaht")}
                    </FieldLabel>
                    <Input
                      id="deposit_amount"
                      type="number"
                      value={formData.deposit_amount}
                      onChange={set("deposit_amount")}
                      placeholder="0"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="note">{t("common.note")}</FieldLabel>
                  <Input
                    id="note"
                    value={formData.note}
                    onChange={set("note")}
                    placeholder={t("contracts.noteExtra")}
                  />
                </Field>

                {/* แนบไฟล์สัญญาเช่าตัวจริง (PDF/Word) — optional ตอนสร้าง */}
                <Field>
                  <FieldLabel htmlFor="contract_file">
                    {language === "th"
                      ? "แนบไฟล์สัญญาเช่า (PDF/Word)"
                      : "Attach contract file (PDF/Word)"}
                  </FieldLabel>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="contract_file"
                      className="flex-1 flex items-center gap-2 h-9 rounded-md border border-dashed border-input px-3 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Paperclip className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {newContractFile
                          ? newContractFile.name
                          : language === "th"
                            ? "เลือกไฟล์ (ไม่บังคับ)"
                            : "Choose file (optional)"}
                      </span>
                    </label>
                    <input
                      id="contract_file"
                      type="file"
                      accept={CONTRACT_FILE_ACCEPT}
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        if (file && !validateContractFile(file)) {
                          e.target.value = "";
                          setNewContractFile(null);
                          return;
                        }
                        setNewContractFile(file);
                      }}
                    />
                    {newContractFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setNewContractFile(null)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "th"
                      ? "ถ้าไม่แนบตอนนี้ สามารถอัปโหลดภายหลังได้จากหน้ารายละเอียดสัญญา"
                      : "You can also upload this later from the contract detail view."}
                  </p>
                </Field>
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
                  disabled={
                    submitting || !formData.tenant_id || !formData.room_id
                  }
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("contracts.create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("contracts.statsTotal")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contracts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("contracts.statsActive")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {contracts.filter((c) => c.status === "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("contracts.statsExpiredOrTerminated")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {contracts.filter((c) => c.status !== "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("contracts.statsTotalDeposit")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalDeposit.toLocaleString("th-TH")} {t("contracts.baht")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("contracts.statsTotalRefunded")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {totalRefunded.toLocaleString("th-TH")} {t("contracts.baht")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("contracts.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="active">
                  {t("status.active.label")}
                </SelectItem>
                <SelectItem value="expired">
                  {t("status.expired.label")}
                </SelectItem>
                <SelectItem value="terminated">
                  {t("status.terminated.label")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contracts List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredContracts.map((contract) => {
            const statusColor =
              statusColors[contract.status] ?? statusColors.expired;
            const statusKey = `status.${contract.status}.label` as string;
            return (
              <Card key={contract.contract_id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4 flex-1">
                      <div className="bg-primary/10 p-3 rounded-lg h-fit">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-bold text-lg">
                              {contract.tenant_name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {t("contracts.room")} {contract.room_number} • CNT
                              {String(contract.contract_id).padStart(3, "0")}
                            </p>
                            <div className="flex gap-2 mt-3 flex-wrap">
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {t("contracts.rentLabel")}{" "}
                                {Number(contract.rent_amount).toLocaleString(
                                  "th-TH",
                                )}{" "}
                                {t("contracts.baht")}
                              </span>
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {t("contracts.depositLabel")}{" "}
                                {Number(contract.deposit_amount).toLocaleString(
                                  "th-TH",
                                )}{" "}
                                {t("contracts.baht")}
                              </span>
                              {(() => {
                                const badge = depositStatusBadge(
                                  contract,
                                  language,
                                );
                                return badge ? (
                                  <span
                                    className={`text-xs px-2 py-1 rounded ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                ) : null;
                              })()}
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {formatDate(contract.start_date)} —{" "}
                                {formatDate(contract.end_date)}
                              </span>
                              {contract.contract_file ? (
                                <span className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded flex items-center gap-1">
                                  <Paperclip className="h-3 w-3" />
                                  {language === "th"
                                    ? "มีไฟล์แนบ"
                                    : "File attached"}
                                </span>
                              ) : (
                                <span className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-1 rounded">
                                  {language === "th"
                                    ? "ยังไม่มีไฟล์แนบ"
                                    : "No file yet"}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded ${statusColor}`}
                          >
                            {t(statusKey)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      {contract.contract_file && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={downloadingId === contract.contract_id}
                          onClick={() => handleDownloadFile(contract)}
                        >
                          {downloadingId === contract.contract_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          <span className="hidden sm:inline">
                            {language === "th" ? "ไฟล์สัญญา" : "File"}
                          </span>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setViewingContract(contract)}
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          {t("common.view")}
                        </span>
                      </Button>
                      {contract.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => handleTerminate(contract)}
                        >
                          <XCircle className="w-4 h-4" />
                          <span className="hidden sm:inline">
                            {t("common.cancel")}
                          </span>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredContracts.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  {t("contracts.notFound")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* View Dialog */}
      <Dialog
        open={!!viewingContract}
        onOpenChange={(open) => {
          if (!open) {
            setViewingContract(null);
            setReplaceFile(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("contracts.detailTitle")}</DialogTitle>
          </DialogHeader>
          {viewingContract && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">
                    {t("contracts.tenantName")}
                  </p>
                  <p className="font-medium">{viewingContract.tenant_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {language === "th" ? "เลขประจำตัวประชาชน" : "ID Card"}
                  </p>
                  <p className="font-medium">
                    {viewingContract.tenant_id_card || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("contracts.room")}</p>
                  <p className="font-medium">{viewingContract.room_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("contracts.startDate")}
                  </p>
                  <p className="font-medium">
                    {formatDate(viewingContract.start_date)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("contracts.endDate")}
                  </p>
                  <p className="font-medium">
                    {formatDate(viewingContract.end_date)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("contracts.monthlyRent")}
                  </p>
                  <p className="font-medium">
                    {formatCurrency(Number(viewingContract.rent_amount))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("contracts.deposit")}
                  </p>
                  <p className="font-medium">
                    {formatCurrency(Number(viewingContract.deposit_amount))}
                  </p>
                  {(() => {
                    const badge = depositStatusBadge(viewingContract, language);
                    return badge ? (
                      <span
                        className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    ) : null;
                  })()}
                  {viewingContract.deposit_deduction_note && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === "th"
                        ? "หมายเหตุการหัก: "
                        : "Deduction note: "}
                      {viewingContract.deposit_deduction_note}
                    </p>
                  )}
                </div>
              </div>
              {viewingContract.note && (
                <div className="text-sm">
                  <p className="text-muted-foreground">{t("common.note")}</p>
                  <p>{viewingContract.note}</p>
                </div>
              )}

              {/* ── ไฟล์สัญญาเช่า (ดู/ดาวน์โหลด/อัปโหลด-แทนที่) ─────────────── */}
              <div className="pt-4 border-t space-y-2">
                <p className="text-sm font-medium">
                  {language === "th" ? "ไฟล์สัญญาเช่า" : "Contract file"}
                </p>

                {viewingContract.contract_file ? (
                  <div className="flex items-center justify-between gap-2 bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Paperclip className="h-4 w-4 shrink-0 text-green-600" />
                      <span className="truncate">
                        {language === "th"
                          ? "มีไฟล์สัญญาแนบอยู่แล้ว"
                          : "A contract file is attached"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 shrink-0"
                      disabled={downloadingId === viewingContract.contract_id}
                      onClick={() => handleDownloadFile(viewingContract)}
                    >
                      {downloadingId === viewingContract.contract_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {language === "th" ? "ดาวน์โหลด" : "Download"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {language === "th"
                      ? "ยังไม่มีไฟล์สัญญาแนบสำหรับห้องนี้"
                      : "No contract file has been attached yet"}
                  </p>
                )}

                {/* อัปโหลด / แทนที่ไฟล์ */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="replace_contract_file"
                    className="flex-1 flex items-center gap-2 h-9 rounded-md border border-dashed border-input px-3 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {replaceFile
                        ? replaceFile.name
                        : viewingContract.contract_file
                          ? language === "th"
                            ? "เลือกไฟล์ใหม่เพื่อแทนที่"
                            : "Choose a new file to replace"
                          : language === "th"
                            ? "เลือกไฟล์เพื่ออัปโหลด"
                            : "Choose a file to upload"}
                    </span>
                  </label>
                  <input
                    id="replace_contract_file"
                    ref={replaceFileInputRef}
                    type="file"
                    accept={CONTRACT_FILE_ACCEPT}
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file && !validateContractFile(file)) {
                        e.target.value = "";
                        setReplaceFile(null);
                        return;
                      }
                      setReplaceFile(file);
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={!replaceFile || uploadingReplace}
                    onClick={handleReplaceFileUpload}
                    className="gap-1 shrink-0"
                  >
                    {uploadingReplace && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {language === "th" ? "อัปโหลด" : "Upload"}
                  </Button>
                </div>
              </div>

              {viewingContract.status === "active" && (
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={() => handleTerminate(viewingContract)}
                >
                  <XCircle className="w-4 h-4" />
                  {t("contracts.terminateAction")}
                </Button>
              )}
              {viewingContract.status === "expired" && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => openRenewDialog(viewingContract)}
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("contracts.renewAction")}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 gap-2"
                    onClick={() => openCheckoutDialog(viewingContract)}
                  >
                    <LogOut className="w-4 h-4" />
                    {t("contracts.moveOutAction")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Renew Dialog */}
      <Dialog
        open={!!renewingContract}
        onOpenChange={(open) => {
          if (!open) {
            setRenewingContract(null);
            setRenewForm(emptyRenewForm);
          }
        }}
      >
        <DialogContent className="max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>{t("contracts.renewTitle")}</DialogTitle>
            <DialogDescription>
              {renewingContract?.tenant_name} • {t("contracts.room")}{" "}
              {renewingContract?.room_number}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRenewSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="renew_end_date">
                  {t("contracts.newEndDate")}
                </FieldLabel>
                <DatePickerField
                  id="renew_end_date"
                  value={renewForm.end_date}
                  onChange={(v) => setRenewForm((p) => ({ ...p, end_date: v }))}
                  language={language}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="renew_rent_amount">
                  {t("contracts.rentAmountBaht")}
                </FieldLabel>
                <Input
                  id="renew_rent_amount"
                  type="number"
                  value={renewForm.rent_amount}
                  onChange={(e) =>
                    setRenewForm((p) => ({
                      ...p,
                      rent_amount: e.target.value,
                    }))
                  }
                  placeholder={t("contracts.useRoomRent")}
                />
              </Field>
            </FieldGroup>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRenewingContract(null);
                  setRenewForm(emptyRenewForm);
                }}
                disabled={renewSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={renewSubmitting || !renewForm.end_date}
              >
                {renewSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("contracts.renewConfirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog
        open={!!checkingOutContract}
        onOpenChange={(open) => {
          if (!open) {
            setCheckingOutContract(null);
            setCheckoutForm(emptyCheckoutForm);
          }
        }}
      >
        <DialogContent className="max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>{t("contracts.moveOutTitle")}</DialogTitle>
            <DialogDescription>
              {checkingOutContract?.tenant_name} • {t("contracts.room")}{" "}
              {checkingOutContract?.room_number}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCheckoutSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="checkout_date">
                  {t("contracts.moveOutDate")}
                </FieldLabel>
                <DatePickerField
                  id="checkout_date"
                  value={checkoutForm.checkout_date}
                  onChange={(v) =>
                    setCheckoutForm((p) => ({ ...p, checkout_date: v }))
                  }
                  language={language}
                  required
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                {t("contracts.checkoutDepositNote")}
              </p>
            </FieldGroup>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCheckingOutContract(null);
                  setCheckoutForm(emptyCheckoutForm);
                }}
                disabled={checkoutSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={checkoutSubmitting || !checkoutForm.checkout_date}
              >
                {checkoutSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("contracts.moveOutConfirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
