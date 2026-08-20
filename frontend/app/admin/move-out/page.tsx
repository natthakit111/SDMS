//admin/move-out/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  LogOut,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Loader2,
  Search,
  Wallet,
  ChevronRight,
  CalendarClock,
  CalendarCheck,
} from "lucide-react";
import { moveOutAPI } from "@/lib/api/moveOut.api";
import { toast } from "sonner";
import { useLanguage } from "@/context/language-context";
import { todayDateString } from "@/lib/utils";
import { DatePickerField } from "@/components/common/date-picker-field";
import { MoveOutRequest } from "@/types/index";

interface DepositPreview {
  deposit_amount: number;
  days_remaining: number;
  fine_amount: number;
  fine_reason: string | null;
  net_refund: number;
  checkout_date_used?: string; // ⚠️ ใหม่
  tenant_requested_date?: string; // ⚠️ ใหม่
}

const fmtDate = (d: string, lang: string) =>
  new Date(d).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);

const statusConfig = {
  pending: {
    labelKey: "moveout.statusPending",
    icon: Clock,
    color: "text-warning",
    bg: "bg-warning/10",
  },
  approved: {
    labelKey: "moveout.statusApproved",
    icon: CheckCircle,
    color: "text-success",
    bg: "bg-success/10",
  },
  rejected: {
    labelKey: "moveout.statusRejected",
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminMoveOutPage() {
  const { t, language } = useLanguage();
  const [requests, setRequests] = useState<MoveOutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingRequest, setViewingRequest] = useState<MoveOutRequest | null>(
    null,
  );
  const [adminNote, setAdminNote] = useState("");
  const [processing, setProcessing] = useState(false);

  // ── เงินประกัน ────────────────────────────────────────────────────────────
  const [depositPreview, setDepositPreview] = useState<DepositPreview | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deductionExtra, setDeductionExtra] = useState("0");
  const [deductionExtraNote, setDeductionExtraNote] = useState("");
  // ⚠️ ใหม่: วันที่ย้ายออกจริงที่แอดมินยืนยัน — แยกจาก move_out_date ที่
  // tenant เสนอ ใช้คำนวณค่าปรับ/เงินคืนแทน (ดู backend moveOutController.js)
  const [actualCheckoutDate, setActualCheckoutDate] =
    useState(todayDateString());

  // ── Fetch Move-out Requests ───────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await moveOutAPI.getAll();
      setRequests(res.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("moveout.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = requests.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
      r.room_number?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── ยอดคืนสุทธิ (คำนวณสดตามที่แอดมินกรอกหักเพิ่ม) ──────────────────────────
  const extraNum = Math.max(0, Number(deductionExtra) || 0);
  const finalRefund = depositPreview
    ? Math.max(0, depositPreview.net_refund - extraNum)
    : 0;
  const extraExceeds = depositPreview
    ? extraNum > depositPreview.net_refund
    : false;

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!viewingRequest) return;
    if (extraExceeds) {
      toast.error(t("moveout.deductionExceeds"));
      return;
    }
    if (
      !confirm(
        `${t("moveout.confirmApprove")} ${viewingRequest.first_name} ${viewingRequest.last_name}?\n${t("moveout.confirmApproveDetail")}`,
      )
    )
      return;
    setProcessing(true);
    try {
      await moveOutAPI.approve(viewingRequest.request_id, {
        admin_note: adminNote,
        actual_checkout_date: actualCheckoutDate, // ⚠️ ใหม่
        deduction_extra: extraNum,
        deduction_extra_note: deductionExtraNote || undefined,
      });
      toast.success(t("moveout.approveSuccess"));
      closeDialog();
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("moveout.approveError"));
    } finally {
      setProcessing(false);
    }
  };

  // ── Reject ────────────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!viewingRequest) return;
    if (!adminNote.trim()) {
      toast.error(t("moveout.rejectNoteRequired"));
      return;
    }
    setProcessing(true);
    try {
      await moveOutAPI.reject(viewingRequest.request_id, adminNote);
      toast.success(t("moveout.rejectSuccess"));
      closeDialog();
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("moveout.rejectError"));
    } finally {
      setProcessing(false);
    }
  };

  const openDialog = async (r: MoveOutRequest) => {
    setViewingRequest(r);
    setAdminNote(r.admin_note ?? "");
    setDeductionExtra("0");
    setDeductionExtraNote("");
    setDepositPreview(null);
    // ⚠️ ใหม่: reset เป็นวันนี้ทุกครั้งที่เปิด dialog ใหม่
    const today = new Date().toISOString().split("T")[0];
    setActualCheckoutDate(today);

    if (r.status === "pending") {
      setPreviewLoading(true);
      try {
        const res = await moveOutAPI.getDepositPreview(r.request_id, today);
        setDepositPreview(res.data ?? null);
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message ?? t("moveout.depositPreviewError"),
        );
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  // ⚠️ ใหม่: เรียก preview ใหม่ทุกครั้งที่ admin แก้วันที่ย้ายออกจริง
  const handleCheckoutDateChange = async (newDate: string) => {
    setActualCheckoutDate(newDate);
    if (!viewingRequest) return;
    setPreviewLoading(true);
    try {
      const res = await moveOutAPI.getDepositPreview(
        viewingRequest.request_id,
        newDate,
      );
      setDepositPreview(res.data ?? null);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? t("moveout.depositPreviewError"),
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const closeDialog = () => {
    setViewingRequest(null);
    setAdminNote("");
    setDepositPreview(null);
    setDeductionExtra("0");
    setDeductionExtraNote("");
    setActualCheckoutDate(todayDateString()); // ⚠️ ใหม่
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <LogOut className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
          {t("moveout.title")}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t("moveout.subtitle")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          {
            labelKey: "moveout.statusPending",
            value: requests.filter((r) => r.status === "pending").length,
            color: "text-warning",
          },
          {
            labelKey: "moveout.statusApproved",
            value: requests.filter((r) => r.status === "approved").length,
            color: "text-success",
          },
          {
            labelKey: "moveout.statusRejected",
            value: requests.filter((r) => r.status === "rejected").length,
            color: "text-destructive",
          },
        ].map(({ labelKey, value, color }) => (
          <Card key={labelKey}>
            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                {t(labelKey)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className={`text-xl sm:text-2xl font-bold ${color}`}>
                {value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("moveout.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t("moveout.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("moveout.allStatuses")}</SelectItem>
                <SelectItem value="pending">
                  {t("moveout.statusPending")}
                </SelectItem>
                <SelectItem value="approved">
                  {t("moveout.statusApproved")}
                </SelectItem>
                <SelectItem value="rejected">
                  {t("moveout.statusRejected")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("moveout.listTitle")}</CardTitle>
          <CardDescription>
            {t("moveout.totalItems").replace("{n}", String(filtered.length))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("moveout.notFound")}
            </div>
          ) : (
            <>
              {/* ── Mobile: card list (แตะเพื่อดูรายละเอียด) ── */}
              <div className="flex flex-col gap-3 sm:hidden">
                {filtered.map((r) => {
                  const s = statusConfig[r.status];
                  const Icon = s.icon;
                  return (
                    <button
                      key={r.request_id}
                      type="button"
                      onClick={() => openDialog(r)}
                      className="w-full text-left rounded-lg border bg-card p-4 transition-colors active:bg-muted"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {r.first_name} {r.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t("contracts.room")} {r.room_number}
                          </p>
                        </div>
                        <div
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full shrink-0 ${s.bg} ${s.color}`}
                        >
                          <Icon className="h-3 w-3" />
                          {t(s.labelKey)}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col gap-1.5 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-foreground/70">
                            {t("moveout.colMoveOutDate")}:
                          </span>
                          <span className="font-medium text-foreground">
                            {fmtDate(r.move_out_date, language)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-foreground/70">
                            {t("moveout.colSubmittedAt")}:
                          </span>
                          <span>{fmtDate(r.created_at, language)}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end text-xs font-medium text-primary">
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        {t("common.actions")}
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ── Desktop: table ── */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.tenant")}</TableHead>
                      <TableHead>{t("contracts.room")}</TableHead>
                      <TableHead>{t("moveout.colMoveOutDate")}</TableHead>
                      <TableHead>{t("moveout.colSubmittedAt")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead className="text-right">
                        {t("common.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const s = statusConfig[r.status];
                      const Icon = s.icon;
                      return (
                        <TableRow key={r.request_id}>
                          <TableCell className="font-medium">
                            {r.first_name} {r.last_name}
                          </TableCell>
                          <TableCell>{r.room_number}</TableCell>
                          <TableCell>
                            {fmtDate(r.move_out_date, language)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {fmtDate(r.created_at, language)}
                          </TableCell>
                          <TableCell>
                            <div
                              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${s.bg} ${s.color}`}
                            >
                              <Icon className="h-3 w-3" />
                              {t(s.labelKey)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDialog(r)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail / Approve / Reject Dialog */}
      <Dialog
        open={!!viewingRequest}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle>{t("moveout.detailTitle")}</DialogTitle>
            <DialogDescription>{t("moveout.detailDesc")}</DialogDescription>
          </DialogHeader>

          {viewingRequest && (
            <div className="space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("common.tenant")}</p>
                  <p className="font-medium">
                    {viewingRequest.first_name} {viewingRequest.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("contracts.room")}</p>
                  <p className="font-medium">{viewingRequest.room_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("moveout.colSubmittedAt")}
                  </p>
                  <p className="font-medium">
                    {fmtDate(viewingRequest.created_at, language)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("moveout.colMoveOutDate")}
                  </p>
                  <p className="font-medium text-primary">
                    {fmtDate(viewingRequest.move_out_date, language)}
                  </p>
                </div>
              </div>

              <div className="text-sm">
                <p className="text-muted-foreground mb-1">
                  {t("moveout.reason")}
                </p>
                <p className="bg-muted/50 p-3 rounded-lg">
                  {viewingRequest.reason}
                </p>
              </div>

              {/* ── เงินประกัน (เฉพาะคำร้องที่ยัง pending) ───────────────── */}
              {viewingRequest.status === "pending" && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Wallet className="h-4 w-4 text-primary" />
                    {t("moveout.depositTitle")}
                  </div>

                  {/* ⚠️ ใหม่: วันที่ย้ายออกจริง — แยกจาก move_out_date ที่ tenant เสนอ
                      (แสดงไว้ด้านบนใน Info grid แล้วเป็น read-only) แอดมินยืนยันวันจริง
                      ตรงนี้ ใช้คำนวณค่าปรับแทน แก้แล้วคำนวณใหม่ทันที */}
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="actualCheckoutDate">
                        {t("moveout.actualCheckoutDateLabel")}
                      </FieldLabel>
                      <DatePickerField
                        id="actualCheckoutDate"
                        value={actualCheckoutDate}
                        onChange={handleCheckoutDateChange}
                        language={language}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("moveout.actualCheckoutDateHint")}
                      </p>
                    </Field>
                  </FieldGroup>

                  {previewLoading ? (
                    <div className="flex items-center justify-center py-4 text-muted-foreground gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("common.loading")}
                    </div>
                  ) : depositPreview ? (
                    depositPreview.deposit_amount > 0 ? (
                      <>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t("moveout.depositAmount")}
                            </span>
                            <span>
                              {fmtCurrency(depositPreview.deposit_amount)}
                            </span>
                          </div>
                          {depositPreview.fine_amount > 0 && (
                            <div className="flex justify-between text-destructive">
                              <span>
                                {t("moveout.fineAmount")}
                                {depositPreview.fine_reason && (
                                  <span className="text-xs ml-1">
                                    ({depositPreview.fine_reason})
                                  </span>
                                )}
                              </span>
                              <span>
                                -{fmtCurrency(depositPreview.fine_amount)}
                              </span>
                            </div>
                          )}
                        </div>

                        <FieldGroup>
                          <Field>
                            <FieldLabel htmlFor="deductionExtra">
                              {t("moveout.deductionExtraLabel")}
                            </FieldLabel>
                            <Input
                              id="deductionExtra"
                              type="number"
                              min="0"
                              value={deductionExtra}
                              onChange={(e) =>
                                setDeductionExtra(e.target.value)
                              }
                              placeholder="0"
                            />
                            {extraExceeds && (
                              <p className="text-xs text-destructive mt-1">
                                {t("moveout.deductionExceeds")}
                              </p>
                            )}
                          </Field>
                          {extraNum > 0 && (
                            <Field>
                              <FieldLabel htmlFor="deductionExtraNote">
                                {t("moveout.deductionExtraNoteLabel")}
                              </FieldLabel>
                              <Input
                                id="deductionExtraNote"
                                value={deductionExtraNote}
                                onChange={(e) =>
                                  setDeductionExtraNote(e.target.value)
                                }
                                placeholder={t(
                                  "moveout.deductionExtraNotePlaceholder",
                                )}
                              />
                            </Field>
                          )}
                        </FieldGroup>

                        <div className="flex justify-between pt-2 border-t font-bold">
                          <span>{t("moveout.netRefund")}</span>
                          <span className="text-primary">
                            {fmtCurrency(finalRefund)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("moveout.noDeposit")}
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("moveout.depositPreviewUnavailable")}
                    </p>
                  )}
                </div>
              )}

              {/* Admin note */}
              {viewingRequest.status === "pending" ? (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="adminNote">
                      {t("moveout.adminNoteLabel")}
                    </FieldLabel>
                    <Textarea
                      id="adminNote"
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder={t("moveout.adminNotePlaceholder")}
                      rows={3}
                    />
                  </Field>
                </FieldGroup>
              ) : (
                viewingRequest.admin_note && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">
                      {t("moveout.adminNoteTitle")}
                    </p>
                    <p className="bg-muted/50 p-3 rounded-lg">
                      {viewingRequest.admin_note}
                    </p>
                  </div>
                )
              )}

              {/* Actions */}
              {viewingRequest.status === "pending" && (
                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={closeDialog}
                    disabled={processing}
                    className="w-full sm:w-auto"
                  >
                    {t("common.close")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={processing}
                    className="w-full sm:w-auto"
                  >
                    {processing && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <XCircle className="mr-2 h-4 w-4" />
                    {t("moveout.reject")}
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={processing || extraExceeds || previewLoading}
                    className="w-full sm:w-auto"
                  >
                    {processing && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {t("moveout.approve")}
                  </Button>
                </DialogFooter>
              )}

              {viewingRequest.status !== "pending" && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={closeDialog}
                    className="w-full sm:w-auto"
                  >
                    {t("common.close")}
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
