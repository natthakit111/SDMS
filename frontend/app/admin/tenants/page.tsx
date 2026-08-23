// admin/tenants/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/language-context";
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
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { TenantStatusBadge } from "@/components/common/status-badge";
import { PaginationFooter } from "@/components/common/pagination-footer";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  Phone,
  Mail,
  Loader2,
  Eye,
  EyeOff,
  Dices,
  Info,
  DoorOpen,
} from "lucide-react";
import { formatDate, type Locale } from "@/lib/utils";
import { tenantAPI } from "@/lib/api/tenant.api";
import { toast } from "sonner";

interface Tenant {
  tenant_id: number;
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  id_card_number: string;
  phone: string;
  email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  room_number: string | null;
  room_id: number | null;
  contract_status: string | null;
  is_active: boolean;
  created_at: string;
}

interface FormData {
  first_name: string;
  last_name: string;
  password: string;
  email: string;
  phone: string;
  id_card_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

type FieldErrors = Partial<Record<keyof FormData, string>>;

const emptyForm: FormData = {
  first_name: "",
  last_name: "",
  password: "",
  email: "",
  phone: "",
  id_card_number: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
};

const THAI_PHONE_REGEX = /^0[1-9]\d{7,8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ⚠️ เดิมฟังก์ชันนี้แปล error code (เช่น 'PHONE_ALREADY_REGISTERED') เป็น
// ข้อความอ่านง่ายเองในหน้านี้ — ย้ายไปแปลกลางที่ axios response interceptor
// แล้ว (lib/api/axiosInstance.js) เพื่อให้ทุกหน้าได้ประโยชน์เหมือนกัน ไม่ใช่
// แค่หน้านี้ ตอนถึงตรงนี้ err.response.data จึงเป็นข้อความที่แปลแล้วเสมอ
function parseFieldErrors(err: any): {
  fieldErrors: FieldErrors;
  generalMessage: string | null;
} {
  const data = err?.response?.data;
  const rawErrors: any[] =
    data?.errors ?? data?.details ?? (Array.isArray(data) ? data : []);

  const fieldErrors: FieldErrors = {};
  if (Array.isArray(rawErrors)) {
    rawErrors.forEach((e) => {
      const field = e?.path ?? e?.param ?? e?.field;
      const msg = e?.msg ?? e?.message;
      if (field && msg) {
        (fieldErrors as any)[field] = msg;
      }
    });
  }

  const generalMessage =
    Object.keys(fieldErrors).length > 0 ? null : (data?.message ?? null);

  return { fieldErrors, generalMessage };
}

// ✅ Validate ฝั่ง frontend ก่อนยิง API — ลด round-trip และให้ feedback ทันที
// (ยังคงพึ่ง backend validation เป็นด่านสุดท้ายเสมอ อันนี้แค่ช่วยเรื่อง UX)
function validateForm(
  data: FormData,
  isEditing: boolean,
  t: (key: string) => string,
): FieldErrors {
  const errors: FieldErrors = {};

  if (!data.first_name.trim())
    errors.first_name = t("errors.FIRST_NAME_REQUIRED");
  if (!data.last_name.trim()) errors.last_name = t("errors.LAST_NAME_REQUIRED");

  if (!data.phone.trim()) {
    errors.phone = t("errors.PHONE_REQUIRED");
  } else if (!THAI_PHONE_REGEX.test(data.phone.replace(/[\s-]/g, ""))) {
    errors.phone = t("errors.PHONE_FORMAT");
  }

  if (data.email && !EMAIL_REGEX.test(data.email)) {
    errors.email = t("errors.EMAIL_FORMAT");
  }

  if (!isEditing) {
    const idCard = data.id_card_number.replace(/-/g, "");
    if (idCard.length !== 13 || !/^\d+$/.test(idCard)) {
      errors.id_card_number = t("errors.ID_CARD_LENGTH");
    }
    if (!data.password || data.password.length < 6) {
      errors.password = t("errors.PASSWORD_MIN_LENGTH");
    }
  }

  if (
    data.emergency_contact_phone &&
    !THAI_PHONE_REGEX.test(data.emergency_contact_phone.replace(/[\s-]/g, ""))
  ) {
    errors.emergency_contact_phone = t("errors.EMERGENCY_PHONE_FORMAT");
  }

  return errors;
}

// ✅ สุ่มรหัสผ่านที่อ่านง่าย จำง่ายพอสมควร แต่ยังปลอดภัยเกินขั้นต่ำ 6 ตัวของ backend
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function TenantsPage() {
  const { t, language } = useLanguage();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [showInactive, setShowInactive] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ total: 0, totalPages: 0 });

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await tenantAPI.getAll({
        search: searchQuery || undefined,
        inactive: showInactive ? "true" : undefined,
        contract_status: statusFilter !== "all" ? statusFilter : undefined,
        page,
        limit: PAGE_SIZE,
      });
      setTenants(res.data?.items ?? []);
      setPageMeta({
        total: res.data?.pagination?.total ?? 0,
        totalPages: res.data?.pagination?.totalPages ?? 0,
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, showInactive, statusFilter, page, t]);

  useEffect(() => {
    const timer = setTimeout(fetchTenants, 300);
    return () => clearTimeout(timer);
  }, [fetchTenants]);

  // เปลี่ยน filter/search แล้วต้องกลับไปหน้า 1 เสมอ — ไม่งั้นอาจค้างอยู่หน้า
  // ที่ filter ใหม่ไม่มีข้อมูลถึง (เช่น filter เหลือ 2 หน้า แต่ค้างอยู่หน้า 5 เดิม)
  useEffect(() => {
    setPage(1);
  }, [searchQuery, showInactive, statusFilter]);

  // ⚠️ filter contract_status ย้ายไปทำที่ backend แล้ว (ดู tenant.model.js)
  // เพื่อให้ total/pagination ถูกต้องตามหน้าที่แบ่งจริง — ตัวแปรนี้เก็บชื่อ
  // เดิมไว้เพื่อไม่ต้องเปลี่ยน JSX ด้านล่างทั้งหมด
  const filteredTenants = tenants;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ เช็ค client-side ก่อนยิง API — ถ้าไม่ผ่าน หยุดเลย ไม่ต้อง call backend
    const clientErrors = validateForm(formData, !!editingTenant, t);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      toast.error(t("tenants.checkFormErrors"));
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      if (editingTenant) {
        await tenantAPI.update(editingTenant.tenant_id, {
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          email: formData.email,
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
        });
        toast.success(t("common.saveSuccess"));
      } else {
        await tenantAPI.create({
          first_name: formData.first_name,
          last_name: formData.last_name,
          password: formData.password,
          id_card_number: formData.id_card_number,
          phone: formData.phone,
          email: formData.email || undefined,
          emergency_contact_name: formData.emergency_contact_name || undefined,
          emergency_contact_phone:
            formData.emergency_contact_phone || undefined,
        });
        toast.success(t("common.saveSuccess"));
      }
      resetForm();
      fetchTenants();
    } catch (err: any) {
      const { fieldErrors: parsedErrors, generalMessage } =
        parseFieldErrors(err);
      if (Object.keys(parsedErrors).length > 0) {
        setFieldErrors(parsedErrors);
        toast.error(t("tenants.checkFormErrors"));
      } else {
        toast.error(
          generalMessage ?? err?.response?.data?.message ?? t("common.error"),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFieldErrors({});
    setShowPassword(false);
    setFormData({
      first_name: tenant.first_name,
      last_name: tenant.last_name,
      password: "",
      email: tenant.email ?? "",
      phone: tenant.phone,
      id_card_number: tenant.id_card_number,
      emergency_contact_name: tenant.emergency_contact_name ?? "",
      emergency_contact_phone: tenant.emergency_contact_phone ?? "",
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (tenant: Tenant) => {
    if (tenant.contract_status === "active") {
      toast.error(t("tenants.cannotDeleteActive"));
      return;
    }
    if (!confirm(t("common.confirmDelete"))) return;
    try {
      await tenantAPI.delete(tenant.tenant_id);
      toast.success(t("common.deleteSuccess"));
      fetchTenants();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("common.error"));
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingTenant(null);
    setFieldErrors({});
    setShowPassword(false);
    setIsAddDialogOpen(false);
  };

  const set =
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      if (fieldErrors[field]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    };

  const handleGeneratePassword = () => {
    const pwd = generatePassword();
    setFormData((prev) => ({ ...prev, password: pwd }));
    setShowPassword(true);
    if (fieldErrors.password) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.password;
        return next;
      });
    }
  };
  // ⚠️ ใหม่: mask เลขบัตรประชาชนในมุมมอง list — โชว์เต็มแค่ตอน edit
  // (แสดงในฟอร์มปกติ) ป้องกัน shoulder-surfing ตอน admin เปิดดูบนมือถือ
  // ในที่สาธารณะ
  const maskIdCard = (id: string) =>
    id?.length === 13 ? `${id.slice(0, 1)}-XXXX-XXXXX-XX-${id.slice(-1)}` : id;

  const FieldError = ({ field }: { field: keyof FormData }) =>
    fieldErrors[field] ? (
      <p className="text-xs text-destructive mt-1">{fieldErrors[field]}</p>
    ) : null;

  const RequiredMark = () => <span className="text-destructive ml-0.5">*</span>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("tenants.title")}</h1>
          <p className="text-muted-foreground">{t("tenants.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showInactive ? "default" : "outline"}
            onClick={() => {
              setShowInactive(!showInactive);
              setStatusFilter("all");
            }}
          >
            {showInactive ? t("tenants.viewCurrent") : t("tenants.viewHistory")}
          </Button>

          {!showInactive && (
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
                  {t("tenants.add")}
                </Button>
              </DialogTrigger>

              <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTenant ? t("tenants.edit") : t("tenants.addNew")}
                  </DialogTitle>
                  <DialogDescription>
                    {editingTenant
                      ? t("tenants.editDesc")
                      : t("tenants.addDesc")}
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} noValidate>
                  <FieldGroup>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="first_name">
                          {t("common.firstName")}
                          <RequiredMark />
                        </FieldLabel>
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={set("first_name")}
                          aria-invalid={!!fieldErrors.first_name}
                          className={
                            fieldErrors.first_name ? "border-destructive" : ""
                          }
                          maxLength={100}
                        />
                        <FieldError field="first_name" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="last_name">
                          {t("common.lastName")}
                          <RequiredMark />
                        </FieldLabel>
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={set("last_name")}
                          aria-invalid={!!fieldErrors.last_name}
                          className={
                            fieldErrors.last_name ? "border-destructive" : ""
                          }
                          maxLength={100}
                        />
                        <FieldError field="last_name" />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="email">
                          {t("common.email")}
                        </FieldLabel>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={set("email")}
                          aria-invalid={!!fieldErrors.email}
                          className={
                            fieldErrors.email ? "border-destructive" : ""
                          }
                        />
                        <FieldError field="email" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="phone">
                          {t("common.phone")}
                          <RequiredMark />
                        </FieldLabel>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={set("phone")}
                          aria-invalid={!!fieldErrors.phone}
                          className={
                            fieldErrors.phone ? "border-destructive" : ""
                          }
                          placeholder="0812345678"
                          maxLength={10}
                          inputMode="numeric"
                        />
                        <FieldError field="phone" />
                        {!editingTenant && !fieldErrors.phone && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Info className="h-3 w-3 shrink-0" />
                            {t("tenants.usernameNote")}
                          </p>
                        )}
                      </Field>
                    </div>

                    {!editingTenant && (
                      <Field>
                        <FieldLabel htmlFor="id_card_number">
                          {t("tenants.idCard")}
                          <RequiredMark />
                        </FieldLabel>
                        <Input
                          id="id_card_number"
                          value={formData.id_card_number}
                          onChange={set("id_card_number")}
                          aria-invalid={!!fieldErrors.id_card_number}
                          className={
                            fieldErrors.id_card_number
                              ? "border-destructive"
                              : ""
                          }
                          placeholder="เลขบัตรประชาชน 13 หลัก"
                          maxLength={17} // เผื่อ user พิมพ์ขีดคั่น
                          inputMode="numeric"
                        />
                        <FieldError field="id_card_number" />
                      </Field>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="emergency_contact_name">
                          {t("tenants.emergencyName")}
                        </FieldLabel>
                        <Input
                          id="emergency_contact_name"
                          value={formData.emergency_contact_name}
                          onChange={set("emergency_contact_name")}
                          aria-invalid={!!fieldErrors.emergency_contact_name}
                          className={
                            fieldErrors.emergency_contact_name
                              ? "border-destructive"
                              : ""
                          }
                          maxLength={100}
                        />
                        <FieldError field="emergency_contact_name" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="emergency_contact_phone">
                          {t("tenants.emergencyPhone")}
                        </FieldLabel>
                        <Input
                          id="emergency_contact_phone"
                          value={formData.emergency_contact_phone}
                          onChange={set("emergency_contact_phone")}
                          aria-invalid={!!fieldErrors.emergency_contact_phone}
                          className={
                            fieldErrors.emergency_contact_phone
                              ? "border-destructive"
                              : ""
                          }
                          maxLength={10}
                          inputMode="numeric"
                        />
                        <FieldError field="emergency_contact_phone" />
                      </Field>
                    </div>

                    {!editingTenant && (
                      <Field>
                        <FieldLabel htmlFor="password">
                          {t("common.password")}
                          <RequiredMark />
                        </FieldLabel>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              value={formData.password}
                              onChange={set("password")}
                              aria-invalid={!!fieldErrors.password}
                              className={
                                fieldErrors.password
                                  ? "border-destructive pr-10"
                                  : "pr-10"
                              }
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v) => !v)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title={t("tenants.generatePassword")}
                            onClick={handleGeneratePassword}
                          >
                            <Dices className="h-4 w-4" />
                          </Button>
                        </div>
                        <FieldError field="password" />
                      </Field>
                    )}
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
                    <Button type="submit" disabled={submitting}>
                      {submitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingTenant ? t("common.save") : t("tenants.add")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("tenants.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t("common.allStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allStatus")}</SelectItem>
                <SelectItem value="active">
                  {t("tenants.hasContract")}
                </SelectItem>
                <SelectItem value="no_contract">
                  {t("tenants.noContract")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("tenants.list")}
          </CardTitle>
          <CardDescription>
            {t("common.total")} {pageMeta.total}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("common.noData")}
            </div>
          ) : (
            <>
              {/* ── Desktop: table ───────────────────────────────────── */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead>{t("common.contact")}</TableHead>
                    <TableHead>{t("rooms.roomNumber")}</TableHead>
                    <TableHead>{t("tenants.contractStatus")}</TableHead>
                    <TableHead>{t("common.createdAt")}</TableHead>
                    <TableHead className="text-right">
                      {t("common.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant) => (
                    <TableRow key={tenant.tenant_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {tenant.first_name} {tenant.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {maskIdCard(tenant.id_card_number)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {tenant.phone}
                          </div>
                          {tenant.email && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {tenant.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {tenant.room_number ? (
                          <span className="font-medium">
                            {tenant.room_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {showInactive ? (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                            {t("tenants.deleted")}
                          </span>
                        ) : (
                          <TenantStatusBadge
                            status={
                              tenant.contract_status === "active"
                                ? "active"
                                : "pending"
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDate(tenant.created_at, language)}
                      </TableCell>
                      <TableCell className="text-right">
                        {!showInactive && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(tenant)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(tenant)}
                              disabled={tenant.contract_status === "active"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* ── Mobile: card list ──────────────────────────────────
            ⚠️ ใหม่: เดิม table เดียวใช้ทุกขนาดจอ 6 คอลัมน์ล้นจอมือถือ
            แถมมี id_card_number อยู่ในรายการเห็นตรงๆ — ตอนนี้แยกเป็น
            การ์ด + mask เลขบัตรในมุมมอง list ด้วย */}
              <div className="md:hidden space-y-3">
                {filteredTenants.map((tenant) => (
                  <div
                    key={tenant.tenant_id}
                    className="rounded-lg border p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {tenant.first_name} {tenant.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {maskIdCard(tenant.id_card_number)}
                        </p>
                      </div>
                      {showInactive ? (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                          {t("tenants.deleted")}
                        </span>
                      ) : (
                        <TenantStatusBadge
                          status={
                            tenant.contract_status === "active"
                              ? "active"
                              : "pending"
                          }
                        />
                      )}
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{tenant.phone}</span>
                      </div>
                      {tenant.email && (
                        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{tenant.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                        <DoorOpen className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {tenant.room_number ?? "-"}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {t("common.createdAt")}:{" "}
                      {formatDate(tenant.created_at, language)}
                    </div>

                    {!showInactive && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEdit(tenant)}
                        >
                          <Pencil className="h-4 w-4 mr-1.5" />
                          {t("common.edit") ?? "แก้ไข"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(tenant)}
                          disabled={tenant.contract_status === "active"}
                        >
                          <Trash2 className="h-4 w-4 mr-1.5" />
                          {t("common.delete") ?? "ลบ"}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <PaginationFooter
                page={page}
                limit={PAGE_SIZE}
                total={pageMeta.total}
                totalPages={pageMeta.totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
