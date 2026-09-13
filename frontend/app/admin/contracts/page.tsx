//app/admin/contracts/page.tsx

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
  Download,
  Upload,
  Paperclip,
} from "lucide-react";
import { contractAPI } from "@/lib/api/contract.api";
import { parseBlobErrorMessage } from "@/lib/api/axiosInstance";
import { tenantAPI } from "@/lib/api/tenant.api";
import { roomAPI } from "@/lib/api/room.api";
import { toast } from "sonner";
import { useLanguage } from "@/context/language-context";
import { DatePickerField } from "@/components/common/date-picker-field";
import { PaginationFooter } from "@/components/common/pagination-footer";
import { useConfirmDialog } from "@/components/common/confirm-dialog";
import { toISODate, formatDate, formatCurrency } from "@/lib/utils";
import { isValidThaiIdChecksum, isValidPassportFormat } from "@/lib/idValidation";
import { Contract } from "@/types/index";

interface FormData {
  tenant_id: string;
  tenant_id_card: string;
  tenant_id_type: "thai_id" | "passport";
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
  tenant_id_type: "thai_id",
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
  active: "bg-success/10 text-success",
  expired: "bg-destructive/10 text-destructive",
  terminated: "bg-muted text-muted-foreground",
};

const CONTRACT_FILE_ACCEPT = ".pdf,.doc,.docx";
const CONTRACT_FILE_MAX_MB = 10;

// ── Component ──────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const { t, language } = useLanguage();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const displayDate = (d: string | null | undefined) => {
    return d ? formatDate(d, language) : "-";
  };

  const depositStatusBadge = (c: Contract, language: string) => {
    if (Number(c.deposit_amount) <= 0) return null;

    if (c.deposit_status === "refunded") {
      const deduction = Number(c.deposit_deduction || 0);
      if (deduction > 0) {
        return {
          label:
            language === "th"
              ? `คืนบางส่วน ${Number(c.deposit_refund_amount).toLocaleString("th-TH")} (หัก ${deduction.toLocaleString("th-TH")})`
              : `Partially refunded ${Number(c.deposit_refund_amount).toLocaleString("th-TH")} (deducted ${deduction.toLocaleString("th-TH")})`,
          className: "bg-accent/10 text-accent-foreground",
        };
      }
      return {
        label:
          language === "th"
            ? `คืนเงินประกันแล้ว ${Number(c.deposit_refund_amount).toLocaleString("th-TH")}`
            : `Refunded ${Number(c.deposit_refund_amount).toLocaleString("th-TH")}`,
        className: "bg-success/10 text-success",
      };
    }

    return {
      label: language === "th" ? "ถือเงินประกันไว้" : "Deposit held",
      className: "bg-warning/10 text-warning",
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

  const [newContractFile, setNewContractFile] = useState<File | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [uploadingReplace, setUploadingReplace] = useState(false);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const [renewingContract, setRenewingContract] = useState<Contract | null>(
    null,
  );
  const [renewForm, setRenewForm] = useState<RenewFormData>(emptyRenewForm);
  const [renewSubmitting, setRenewSubmitting] = useState(false);

  const [checkingOutContract, setCheckingOutContract] =
    useState<Contract | null>(null);
  const [checkoutForm, setCheckoutForm] =
    useState<CheckoutFormData>(emptyCheckoutForm);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ total: 0, totalPages: 0 });

  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: PAGE_SIZE };
      if (filterStatus !== "all") params.status = filterStatus;
      if (searchTerm) params.search = searchTerm;
      const res = await contractAPI.getAll(params);
      setContracts(res.data?.items ?? []);
      setPageMeta({
        total: res.data?.pagination?.total ?? 0,
        totalPages: res.data?.pagination?.totalPages ?? 0,
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("contracts.loadError"));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchTerm, page]);

  // เปลี่ยน filter/search แล้วต้องกลับไปหน้า 1 เสมอ
  useEffect(() => {
    setPage(1);
  }, [filterStatus, searchTerm]);

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
    const timer = setTimeout(fetchContracts, 300);
    return () => clearTimeout(timer);
  }, [fetchContracts]);
  useEffect(() => {
    fetchFormOptions();
  }, []);

  // ✅ FIX: เลขบัตรขึ้น "-" เพราะ contract จาก API ไม่มี field tenant_id_card
  // (ฝั่ง tenant ใช้ id_card_number แต่ contract คาดหวัง tenant_id_card — backend
  // ยังไม่ได้ join/alias มาให้) ระหว่างรอแก้ backend ทำ fallback ฝั่ง frontend:
  // ค้นหา tenant จาก tenant_id ของสัญญาในลิสต์ tenants ที่โหลดมาแล้ว
  const resolveIdCard = (c: Contract): string => {
    if (c?.tenant_id_card) return c.tenant_id_card;
    const tenant = tenants.find(
      (tn) => String(tn.tenant_id) === String((c as any)?.tenant_id),
    );
    return tenant?.id_card_number || "";
  };

  // ⚠️ search ย้ายไปทำที่ backend แล้ว (ดู contract.model.js) เพื่อให้
  // ค้นหาได้ถูกต้องข้ามทุกหน้า — ตัวแปรนี้เก็บชื่อเดิมไว้
  const filteredContracts = contracts;

  const totalDeposit = contracts
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + Number(c.deposit_amount), 0);

  const totalRefunded = contracts
    .filter((c) => c.deposit_status === "refunded")
    .reduce((sum, c) => sum + Number(c.deposit_refund_amount || 0), 0);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // ⚠️ เดิมเช็คแค่ "ถ้าเป็นตัวเลขล้วนต้อง 13 หลัก" — ถ้าไม่ใช่ตัวเลขล้วน
    // ปล่อยผ่านหมดโดยไม่เช็ค format อะไรเลย (ช่องนี้เขียนทับ tenant.id_card_number
    // จริงตอน submit ดู contract.controller.js createContract) ตอนนี้เช็คแบบ
    // เดียวกับหน้า admin/tenants ทุกประการ แยกตาม tenant_id_type ที่เลือก
    const idCard = formData.tenant_id_card?.trim().replace(/-/g, "").toUpperCase() ?? "";
    if (!idCard) {
      toast.error(
        language === "th"
          ? "กรุณากรอกเลขประจำตัวประชาชนหรือพาสปอร์ต"
          : "ID Card / Passport is required",
      );
      setSubmitting(false);
      return;
    }
    if (formData.tenant_id_type === "passport") {
      if (!isValidPassportFormat(idCard)) {
        toast.error(t("errors.PASSPORT_FORMAT"));
        setSubmitting(false);
        return;
      }
    } else if (idCard.length !== 13 || !/^\d+$/.test(idCard)) {
      toast.error(t("errors.ID_CARD_LENGTH"));
      setSubmitting(false);
      return;
    } else if (!isValidThaiIdChecksum(idCard)) {
      toast.error(t("errors.ID_CARD_CHECKSUM_INVALID"));
      setSubmitting(false);
      return;
    }

    // ✅ FIX: บังคับกรอกวันเริ่ม/สิ้นสุด และเช็คว่าวันสิ้นสุดต้องหลังวันเริ่ม
    // (เดิม form ใส่ noValidate + ปุ่ม submit ไม่ได้เช็ควันที่ ทำให้ส่ง "" ไป backend ได้)
    if (!formData.start_date || !formData.end_date) {
      toast.error(
        language === "th"
          ? "กรุณาเลือกวันเริ่มสัญญาและวันสิ้นสุดสัญญา"
          : "Please select both the start date and the end date",
      );
      setSubmitting(false);
      return;
    }
    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      toast.error(
        language === "th"
          ? "วันสิ้นสุดสัญญาต้องอยู่หลังวันเริ่มสัญญา"
          : "The end date must be after the start date",
      );
      setSubmitting(false);
      return;
    }

    // ✅ FIX: กันค่าเช่า/เงินประกันติดลบ
    const rentValue = formData.rent_amount
      ? parseFloat(formData.rent_amount)
      : 0;
    const depositValue = formData.deposit_amount
      ? parseFloat(formData.deposit_amount)
      : 0;
    if (rentValue < 0 || depositValue < 0) {
      toast.error(
        language === "th"
          ? "ค่าเช่าและเงินประกันต้องไม่ติดลบ"
          : "Rent and deposit amounts cannot be negative",
      );
      setSubmitting(false);
      return;
    }

    try {
      const created = await contractAPI.create({
        tenant_id: parseInt(formData.tenant_id),
        room_id: parseInt(formData.room_id),
        tenant_id_card: idCard,
        tenant_id_type: formData.tenant_id_type,
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

      // ✅ FIX: ถ้าแนบ���ฟล์ล้มเหลว ให้ขึ้น toast แจ้งเตือนอันเดียว
      // (เดิมขึ้นทั้ง error + success พร้อมกัน ทำให้ผู้ใช้สับสน)
      let fileUploadFailed = false;
      if (newContractId && newContractFile) {
        try {
          await contractAPI.uploadFile(newContractId, newContractFile);
        } catch (uploadErr: any) {
          fileUploadFailed = true;
        }
      }

      if (fileUploadFailed) {
        toast.warning(
          language === "th"
            ? "สร้างสัญญาสำเร็จ แต่แนบไฟล์ไม่สำเร็จ กรุณาอัปโหลดไฟล์อีกครั้งภายหลัง"
            : "Contract created, but the file upload failed. Please upload it again later.",
        );
      } else {
        toast.success(t("contracts.createSuccess"));
      }
      resetForm();
      fetchContracts();
      fetchFormOptions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("contracts.createError"));
    } finally {
      setSubmitting(false);
    }
  };

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
    } catch (err) {
      const msg = await parseBlobErrorMessage(err);
      toast.error(
        msg ??
          (language === "th"
            ? "ไม่สามารถดาวน์โหลดไฟล์สัญญาได้"
            : "Failed to download the contract file"),
      );
    } finally {
      setDownloadingId(null);
    }
  };

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

  const handleTerminate = async (contract: Contract) => {
    if (
      !(await confirm(
        `${t("contracts.confirmTerminate")} ${contract.tenant_name} ${t("contracts.confirmTerminate2")} ${contract.room_number} ${t("contracts.confirmTerminate3")}`,
      ))
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

  const openCheckoutDialog = (contract: Contract) => {
    setCheckoutForm({
      checkout_date: toISODate(new Date()),
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
          <h1 className="text-2xl font-bold">{t("contracts.title")}</h1>
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

          <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("contracts.newTitle")}</DialogTitle>
              <DialogDescription>{t("contracts.newDesc")}</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} noValidate>
              <FieldGroup>
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
                        tenant_id_card: selectedTenant?.id_card_number || "",
                        tenant_id_type: selectedTenant?.id_type ?? "thai_id",
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

                <Field>
                  <FieldLabel>{t("tenants.idType")}</FieldLabel>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        formData.tenant_id_type === "thai_id"
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        setFormData((p) => ({ ...p, tenant_id_type: "thai_id" }))
                      }
                    >
                      {t("tenants.idTypeThai")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        formData.tenant_id_type === "passport"
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        setFormData((p) => ({ ...p, tenant_id_type: "passport" }))
                      }
                    >
                      {t("tenants.idTypePassport")}
                    </Button>
                  </div>
                </Field>

                <Field>
                  <FieldLabel>
                    {formData.tenant_id_type === "passport"
                      ? t("tenants.passportNumber")
                      : language === "th"
                        ? "เลขประจำตัวประชาชน"
                        : "ID Card Number"}
                  </FieldLabel>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={formData.tenant_id_card}
                      onChange={set("tenant_id_card")}
                      placeholder={
                        formData.tenant_id_type === "passport"
                          ? t("tenants.passportPlaceholder")
                          : language === "th"
                            ? "กรอกเลขประจำตัวประชาชน"
                            : "Enter ID card number"
                      }
                      // เผื่อ 17 ตัวสำหรับบัตรประชาชนที่วางมาพร้อมขีดคั่น
                      // (X-XXXX-XXXXX-XX-X) — ตัดขีดออกทีหลังตอน validate
                      maxLength={formData.tenant_id_type === "passport" ? 15 : 17}
                      inputMode={
                        formData.tenant_id_type === "passport" ? "text" : "numeric"
                      }
                      className="pl-9"
                    />
                  </div>
                  {!!tenants.find(
                    (tn) => String(tn.tenant_id) === formData.tenant_id,
                  )?.is_placeholder_id && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {t("tenants.placeholderIdWarning")}
                    </p>
                  )}
                </Field>

                <Field>
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

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="rent_amount">
                      {t("contracts.rentAmountBaht")}
                    </FieldLabel>
                    <Input
                      id="rent_amount"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
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
                      min="0"
                      step="1"
                      inputMode="numeric"
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
                    submitting ||
                    !formData.tenant_id ||
                    !formData.room_id ||
                    !formData.start_date ||
                    !formData.end_date
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
            <div className="text-2xl font-bold text-success">
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
        {/* ✅ FIX: col-span-2 บนมือถือ กันไม่ให้การ์ดสุดท้ายอยู่โดดเดี่ยวแถวเดียว
            (ของเดิม grid 2 คอลัมน์ x 5 การ์ด = 2-2-1 การ์ดสุดท้ายลอยแถวเดียว
            ตามที่เห็นในสกรีนช็อต) */}
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("contracts.statsTotalRefunded")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">
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
                  {/* ✅ FIX (layout บนมือถือ): เดิมยัด ไอคอน + ชื่อ + สถานะ +
                      pills + ปุ่ม action ไว้ในแถวแนวนอนเดียวกันหมด แถม pills
                      ยังแชร์แถวกับ badge สถานะ บนจอแคบคอลัมน์เนื้อหาเลยเหลือ
                      กว้างแค่ ~40% → pills ตกบรรทัดเป็นคอลัมน์ผอม ชิดซ้าย
                      ส่วนขวาว่างเปล่า
                      แก้เป็น responsive:
                      - มือถือ: เรียงแนวตั้ง (หัวการ์ด → pills เต็มแถว → ปุ่ม)
                      - จอ sm+: ปุ่ม action กลับไปอยู่ขวาเหมือนเดิม
                      + ดึง pills ออกมาเป็นบล็อกของตัวเองใต้ชื่อ/สถานะ ให้กิน
                      ความกว้างเต็มคอลัมน์ ไม่ต้องแย่งที่กับ badge สถานะ */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-4 flex-1 min-w-0">
                      <div className="bg-primary/10 p-3 rounded-lg h-fit shrink-0">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-bold text-lg truncate">
                              {contract.tenant_name}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {t("contracts.room")} {contract.room_number} • CNT
                              {String(contract.contract_id).padStart(3, "0")}
                            </p>
                          </div>
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded shrink-0 ${statusColor}`}
                          >
                            {t(statusKey)}
                          </span>
                        </div>
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
                            <span className="text-xs bg-success/10 text-success px-2 py-1 rounded flex items-center gap-1">
                              <Paperclip className="h-3 w-3" />
                              {language === "th"
                                ? "มีไฟล์แนบ"
                                : "File attached"}
                            </span>
                          ) : (
                            <span className="text-xs bg-warning/10 text-warning px-2 py-1 rounded">
                              {language === "th"
                                ? "ยังไม่มีไฟล์แนบ"
                                : "No file yet"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap sm:flex-shrink-0">
                      {contract.contract_file && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          disabled={downloadingId === contract.contract_id}
                          onClick={() => handleDownloadFile(contract)}
                          aria-label={
                            language === "th"
                              ? "ดาวน์โหลดไฟล์สัญญา"
                              : "Download contract file"
                          }
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
                        aria-label={t("common.view")}
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
                          aria-label={t("contracts.terminateAction")}
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

          <PaginationFooter
            page={page}
            limit={PAGE_SIZE}
            total={pageMeta.total}
            totalPages={pageMeta.totalPages}
            onPageChange={setPage}
          />
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
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("contracts.detailTitle")}</DialogTitle>
            {/* ✅ FIX: เพิ่ม DialogDescription กัน Radix warn เรื่อง a11y
                และให้ screen reader อ่านบริบทของ dialog */}
            <DialogDescription>
              {viewingContract
                ? `${viewingContract.tenant_name} • ${t("contracts.room")} ${viewingContract.room_number}`
                : ""}
            </DialogDescription>
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
                    {resolveIdCard(viewingContract) || "-"}
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
        <DialogContent className="w-[calc(100%-2rem)] max-w-md overflow-visible">
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
                  min="0"
                  step="1"
                  inputMode="numeric"
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
        <DialogContent className="w-[calc(100%-2rem)] max-w-md overflow-visible">
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
      {ConfirmDialog}
    </div>
  );
}
