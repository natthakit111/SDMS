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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import {
  MaintenanceStatusBadge,
  PriorityBadge,
} from "@/components/common/status-badge";
import { Plus, CheckCircle, Loader2, Wrench, Camera, X } from "lucide-react";
import { maintenanceAPI } from "@/lib/api/maintenance.api";
import { useLanguage } from "@/context/language-context";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Request {
  request_id: number;
  category: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: string;
  created_at: string;
  admin_note: string | null;
  image_path: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  room_number: string;
}

const DESCRIPTION_MIN_LENGTH = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

const imgUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_API_URL ?? ""}/${path}`;
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function TenantMaintenancePage() {
  const { t, language } = useLanguage();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [formData, setFormData] = useState({
    category: "",
    description: "",
    priority: "medium",
  });

  // ── รูปแนบ ──
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── ดูรายละเอียด (read-only) ──
  const [viewingRequest, setViewingRequest] = useState<Request | null>(null);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const fetchRequests = () => {
    maintenanceAPI
      .getMyRequests()
      .then((r) => setRequests(r.data ?? []))
      .catch((err) => {
        // 404 = ยังไม่มีรายการ (user ใหม่) — ไม่ต้อง toast
        if (err?.response?.status !== 404) {
          toast.error(t("maintenance.loadError"));
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setImageFile(f);
    setImagePreview(f ? URL.createObjectURL(f) : null);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setFormData({ category: "", description: "", priority: "medium" });
    clearImage();
  };

  const handleSubmit = async () => {
    const trimmedDescription = formData.description.trim();

    if (!formData.category || !trimmedDescription) {
      toast.error(t("settings.errorFillAll"));
      return;
    }

    // ✅ เช็คความยาวก่อนส่ง ให้ตรงกับ backend (isLength min: 10)
    if (trimmedDescription.length < DESCRIPTION_MIN_LENGTH) {
      toast.error(
        language === "th"
          ? `กรุณาระบุรายละเอียดอย่างน้อย ${DESCRIPTION_MIN_LENGTH} ตัวอักษร`
          : `Description must be at least ${DESCRIPTION_MIN_LENGTH} characters`,
      );
      return;
    }

    setSubmitting(true);
    try {
      await maintenanceAPI.create(formData, imageFile ?? undefined);
      setDone(true);
      setTimeout(() => {
        setDialogOpen(false);
        setDone(false);
        resetForm();
        fetchRequests();
      }, 1500);
    } catch (err: any) {
      // ✅ ดึงข้อความ error จริงจาก express-validator มาโชว์ แทน "Validation failed" เฉยๆ
      const validationErrors = err?.response?.data?.errors;
      if (Array.isArray(validationErrors) && validationErrors.length > 0) {
        toast.error(validationErrors[0].msg);
      } else {
        toast.error(
          err?.response?.data?.message ?? t("maintenance.updateError"),
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const categoryOptions = [
    { value: "ซ่อมแซม", label: language === "th" ? "ซ่อมแซม" : "Repair" },
    {
      value: "ทำความสะอาด",
      label: language === "th" ? "ทำความสะอาด" : "Cleaning",
    },
    { value: "ไฟฟ้า", label: language === "th" ? "ไฟฟ้า" : "Electrical" },
    { value: "ประปา", label: language === "th" ? "ประปา" : "Plumbing" },
    { value: "อื่นๆ", label: language === "th" ? "อื่นๆ" : "Other" },
  ];

  const descLength = formData.description.trim().length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {t("tenant.maintenance.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("tenant.maintenance.subtitle")}
          </p>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setDone(false);
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t("tenant.maintenance.new")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("tenant.maintenance.title")}</DialogTitle>
              <DialogDescription>
                {t("tenant.maintenance.subtitle")}
              </DialogDescription>
            </DialogHeader>

            {done ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="font-medium">{t("tenant.maintenance.success")}</p>
              </div>
            ) : (
              <FieldGroup>
                <Field>
                  <FieldLabel>{t("maintenance.colCategory")}</FieldLabel>
                  <Select
                    value={formData.category}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, category: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("maintenance.colCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>{t("maintenance.description")}</FieldLabel>
                  <Textarea
                    placeholder={t("maintenance.description")}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    className="min-h-28"
                  />
                  {descLength > 0 && descLength < DESCRIPTION_MIN_LENGTH && (
                    <p className="text-xs mt-1 text-muted-foreground">
                      {language === "th"
                        ? `${descLength}/${DESCRIPTION_MIN_LENGTH} ตัวอักษรขั้นต่ำ`
                        : `${descLength}/${DESCRIPTION_MIN_LENGTH} characters minimum`}
                    </p>
                  )}
                </Field>

                <Field>
                  <FieldLabel>{t("maintenance.colPriority")}</FieldLabel>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, priority: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t("priority.low")}</SelectItem>
                      <SelectItem value="medium">
                        {t("priority.medium")}
                      </SelectItem>
                      <SelectItem value="high">{t("priority.high")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {/* ── รูปแนบ — ปุ่มอัปโหลด + preview (เหมือนหน้ามิเตอร์) ── */}
                <Field>
                  <FieldLabel>
                    {language === "th"
                      ? "รูปประกอบ (ไม่บังคับ)"
                      : "Attached photo (optional)"}
                  </FieldLabel>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt={language === "th" ? "รูปประกอบ" : "Attached photo"}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={clearImage}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="h-4 w-4" />
                      {language === "th" ? "อัปโหลดรูปภาพ" : "Upload photo"}
                    </Button>
                  )}
                </Field>
              </FieldGroup>
            )}

            {!done && (
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("common.submit")}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t("common.all"), value: requests.length, color: "" },
          {
            label: t("status.in_progress"),
            value: requests.filter((r) => r.status === "in_progress").length,
            color: "text-blue-500",
          },
          {
            label: t("status.resolved"),
            value: requests.filter((r) => r.status === "resolved").length,
            color: "text-green-500",
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

      <Card>
        <CardHeader>
          <CardTitle>{t("maintenance.listTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
              <p className="font-medium text-muted-foreground">
                {t("empty.noMaintenance")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("empty.noMaintenanceDesc")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div
                  key={r.request_id}
                  onClick={() => setViewingRequest(r)}
                  className="flex items-start gap-4 p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{r.category}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {r.description}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <PriorityBadge priority={r.priority} />
                          <span className="text-xs text-muted-foreground">
                            {fmtDate(r.created_at)}
                          </span>
                        </div>
                      </div>
                      <MaintenanceStatusBadge status={r.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Detail Dialog (read-only — tenant ไม่มีสิทธิ์แก้ไข) */}
      <Dialog
        open={!!viewingRequest}
        onOpenChange={(open) => !open && setViewingRequest(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {t("maintenance.detailTitle")}
            </DialogTitle>
          </DialogHeader>

          {viewingRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("meters.colRoom")}</p>
                  <p className="font-medium">{viewingRequest.room_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("maintenance.colCategory")}
                  </p>
                  <p className="font-medium">{viewingRequest.category}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("maintenance.colPriority")}
                  </p>
                  <PriorityBadge priority={viewingRequest.priority} />
                </div>
                <div>
                  <p className="text-muted-foreground">{t("common.status")}</p>
                  <MaintenanceStatusBadge status={viewingRequest.status} />
                </div>
              </div>

              <div className="text-sm">
                <p className="text-muted-foreground mb-1">
                  {t("maintenance.description")}
                </p>
                <p className="bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">
                  {viewingRequest.description}
                </p>
              </div>

              {imgUrl(viewingRequest.image_path) && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">
                    {t("meters.image")}
                  </p>
                  <img
                    src={imgUrl(viewingRequest.image_path) ?? ""}
                    alt={viewingRequest.category}
                    className="w-full rounded-lg object-contain max-h-64 bg-muted"
                  />
                </div>
              )}

              {viewingRequest.assigned_to && (
                <div className="text-sm">
                  <p className="text-muted-foreground">
                    {t("maintenance.assignedTo")}
                  </p>
                  <p className="font-medium">{viewingRequest.assigned_to}</p>
                </div>
              )}

              {viewingRequest.admin_note && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">
                    {t("maintenance.adminNote")}
                  </p>
                  <p className="bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">
                    {viewingRequest.admin_note}
                  </p>
                </div>
              )}

              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="text-muted-foreground">
                  {t("maintenance.colReportedAt")}
                </span>
                <span>{fmtDate(viewingRequest.created_at)}</span>
              </div>

              {viewingRequest.resolved_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {language === "th" ? "วันที่เสร็จสิ้น" : "Resolved on"}
                  </span>
                  <span>{fmtDate(viewingRequest.resolved_at)}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
