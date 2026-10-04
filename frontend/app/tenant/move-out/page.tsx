// app/tenant/move-out/page.tsx

"use client";

import { useState, useEffect } from "react";
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
  Wallet,
} from "lucide-react";
import { moveOutAPI } from "@/lib/api/moveOut.api";
import { contractAPI } from "@/lib/api/contract.api";
import { useLanguage } from "@/context/language-context";
import { toast } from "sonner";
import { MoveOutRequest } from "@/types";
import { DatePickerField } from "@/components/common/date-picker-field";
import { toISODate } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContractInfo {
  deposit_amount: number;
  rent_amount: number;
  end_date: string | null;
}

type MoveOutStatus = "pending" | "approved" | "rejected";

// ต้องตรงกับ NOTICE_DAYS ใน backend moveOut.controller.js
const NOTICE_DAYS = 30;

// แปลง 'YYYY-MM-DD' เป็น Date ตาม local (ไม่ใช้ new Date(string) ที่ตีเป็น UTC)
const parseLocalDate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function MoveOutPage() {
  const { t, language } = useLanguage();
  const [requests, setRequests] = useState<MoveOutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ moveOutDate: "", reason: "" });

  // ── Filter (matches the maintenance page pattern) ──
  const [statusFilter, setStatusFilter] = useState<MoveOutStatus | "all">(
    "all",
  );

  // ── ข้อมูลสัญญาจริง (ดึงจาก contract API) — ใช้ rent_amount/deposit_amount
  //    คำนวณค่าปรับ และ end_date จำกัดวันที่เลือกสูงสุดใน date picker ─────────
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [loadingContract, setLoadingContract] = useState(true);

  useEffect(() => {
    contractAPI
      .getMyContract()
      .then((r) => {
        const c = r.data ?? r;
        setContract({
          deposit_amount: Number(c?.deposit_amount ?? 0),
          rent_amount: Number(c?.rent_amount ?? 0),
          end_date: c?.end_date ?? null,
        });
      })
      .catch(() =>
        setContract({ deposit_amount: 0, rent_amount: 0, end_date: null }),
      )
      .finally(() => setLoadingContract(false));
  }, []);

  // ── คำนวณค่าปรับ/เงินประกันคืนโดยประมาณ ────────────────────────────────
  // ⚠️ ต้องตรงกับ backend's calcDepositRefund():
  //    แจ้งล่วงหน้า (วันที่ส่งคำร้อง = วันนี้ → วันย้ายออก) น้อยกว่า 30 วัน
  //    = ปรับค่าเช่า 1 เดือน (ไม่เกินเงินประกัน) — ไม่เกี่ยวกับวันสิ้นสุดสัญญา
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const noticeDays = formData.moveOutDate
    ? Math.round(
        (parseLocalDate(formData.moveOutDate).getTime() -
          todayStart.getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  const isShortNotice = noticeDays !== null && noticeDays < NOTICE_DAYS;
  const depositAmount = contract?.deposit_amount ?? 0;
  const fineAmount = isShortNotice
    ? Math.min(contract?.rent_amount ?? 0, depositAmount)
    : 0;
  const estimatedRefund = Math.max(0, depositAmount - fineAmount);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const fmtBaht = (n: number) =>
    n.toLocaleString(language === "th" ? "th-TH" : "en-US");

  const statusConfig: Record<
    string,
    { label: string; icon: typeof Clock; color: string }
  > = {
    pending: {
      label: t("status.pending"),
      icon: Clock,
      color: "text-warning",
    },
    approved: {
      label: t("status.approved"),
      icon: CheckCircle,
      color: "text-success",
    },
    rejected: {
      label: t("status.rejected"),
      icon: XCircle,
      color: "text-destructive",
    },
  };

  // ✅ FIX: fallback สำหรับสถานะที่ไม่ตรง key ไหนเลย (เช่น status ใหม่ที่
  //    backend เพิ่มมาทีหลัง หรือ data เก่าที่ค่าเพี้ยน) — เดิมไม่มี fallback
  //    ทำให้ r.status ที่ไม่รู้จักจะทำให้ `s` เป็น undefined แล้ว
  //    `s.icon` throw error พังทั้งหน้าทันที
  const getStatusDisplay = (status: string) =>
    statusConfig[status] ?? {
      label: status,
      icon: AlertCircle,
      color: "text-muted-foreground",
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

  const statusCounts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  const statCards: {
    key: MoveOutStatus | "all";
    label: string;
    color: string;
  }[] = [
    { key: "all", label: t("common.all"), color: "" },
    { key: "pending", label: t("status.pending"), color: "text-warning" },
    { key: "approved", label: t("status.approved"), color: "text-success" },
    { key: "rejected", label: t("status.rejected"), color: "text-destructive" },
  ];

  const filteredRequests =
    statusFilter === "all"
      ? requests
      : requests.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("tenant.moveout.title")}</h1>
          <p className="text-muted-foreground mt-2">
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
            <Button className="w-full sm:w-auto gap-2" disabled={hasPending}>
              <Plus className="h-4 w-4" />
              {hasPending
                ? t("tenant.moveout.hasPending")
                : t("moveout.request")}
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto rounded-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LogOut className="h-5 w-5" />
                {t("moveout.request")}
              </DialogTitle>
              <DialogDescription>{t("moveout.notice30")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <FieldGroup className="space-y-4">
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">{t("moveout.notice30")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("moveout.infoFine")}
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
                    // ห้ามเลือกวันที่ผ่านมาแล้ว (backend ก็ปฏิเสธเช่นกัน)
                    minDate={toISODate(new Date())}
                    // ห้ามเลือกเกินวันสิ้นสุดสัญญา (backend ปฏิเสธเช่นกัน)
                    maxDate={
                      contract?.end_date
                        ? toISODate(new Date(contract.end_date))
                        : undefined
                    }
                  />
                </Field>

                {/* ส่วนประเมินค่าปรับ/เงินประกันคืน — ใช้กฎเดียวกับ backend
                    calcDepositRefund() (ดู comment ด้านบนของ noticeDays) */}
                {formData.moveOutDate && (
                  <div
                    className={`rounded-lg border p-3 flex gap-3 ${
                      isShortNotice
                        ? "bg-destructive/10 border-destructive/30"
                        : "bg-success/10 border-success/30"
                    }`}
                  >
                    {isShortNotice ? (
                      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    ) : (
                      <Wallet className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="text-sm space-y-1">
                      {loadingContract ? (
                        <p className="text-muted-foreground flex items-center gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {language === "th"
                            ? "กำลังดึงข้อมูลสัญญา..."
                            : "Loading contract info..."}
                        </p>
                      ) : isShortNotice ? (
                        <>
                          <p className="font-medium text-destructive">
                            {language === "th"
                              ? `แจ้งล่วงหน้า ${noticeDays} วัน (ไม่ครบ ${NOTICE_DAYS} วัน มีค่าปรับ)`
                              : `${noticeDays} days' notice (less than ${NOTICE_DAYS} — a fine applies)`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "th"
                              ? `ค่าปรับโดยประมาณ ฿${fmtBaht(fineAmount)} (ค่าเช่า 1 เดือน) หักจากเงินประกัน คาดว่าจะได้รับคืนประมาณ ฿${fmtBaht(estimatedRefund)} (ยังไม่รวมค่าน้ำ-ไฟและค่าเสียหายที่คำนวณจริงตอนตรวจสอบห้อง) หากเลือกวันย้ายออกให้ห่างจากวันนี้อย่างน้อย ${NOTICE_DAYS} วัน จะไม่มีค่าปรับ`
                              : `Estimated fine: ฿${fmtBaht(fineAmount)} (1 month's rent), deducted from your deposit. Estimated refund: ฿${fmtBaht(estimatedRefund)} (before utility & damage deductions, finalized at move-out inspection). Choose a move-out date at least ${NOTICE_DAYS} days from today to avoid the fine.`}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-green-700 dark:text-green-400">
                            {language === "th"
                              ? `แจ้งล่วงหน้า ${noticeDays} วัน (ครบ ${NOTICE_DAYS} วัน) ไม่มีค่าปรับ`
                              : `${noticeDays} days' notice (${NOTICE_DAYS}+ days) — no fine`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === "th"
                              ? `คาดว่าจะได้รับเงินประกันคืนประมาณ ฿${fmtBaht(estimatedRefund)} (ยังไม่หักค่าน้ำ-ไฟและค่าเสียหาย ซึ่งจะคำนวณจริงตอนตรวจสอบห้องวันย้ายออก)`
                              : `Estimated deposit refund: ฿${fmtBaht(estimatedRefund)} (before utility & damage deductions, finalized on move-out inspection)`}
                          </p>
                        </>
                      )}
                      {/* ⚠️ ยอดจริงที่ admin ใช้อนุมัติ อ้างอิงจากวันย้ายออกจริงที่
                          แอดมินยืนยัน อาจต่างจากวันที่เลือกในฟอร์มนี้ จึงต้องบอก
                          tenant ให้ชัดว่านี่เป็นแค่ตัวเลขอ้างอิง */}
                      <p className="text-xs text-muted-foreground italic pt-1 border-t border-current/10 mt-1">
                        {language === "th"
                          ? "ตัวเลขนี้เป็นเพียงการประมาณการจากวันที่คุณเลือกไว้เท่านั้น ยอดจริงจะคำนวณจากวันที่แอดมินตรวจสอบและยืนยันการย้ายออก ซึ่งอาจแตกต่างจากตัวเลขนี้"
                          : "This is only an estimate based on the date you selected. The final amount is calculated from the actual move-out date confirmed by an admin, and may differ from this figure."}
                      </p>
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

              {/* ✅ FIX: flex-col sm:flex-row + w-full sm:w-auto ให้ตรงกับ
                  pattern ปุ่มใน dialog ของหน้า maintenance/profile */}
              <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={submitting}
                  className="w-full sm:w-auto"
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
                  className="w-full sm:w-auto"
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

      {/* pill strip แนวนอนแบบเดียวกับหน้า maintenance — กดกรอง list ด้านล่างได้ */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {statCards.map(({ key, label, color }) => {
          const isActive = statusFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(isActive ? "all" : key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm transition-colors ${
                isActive
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="text-muted-foreground whitespace-nowrap">
                {label}
              </span>
              <span className={`font-bold ${color || "text-foreground"}`}>
                {statusCounts[key]}
              </span>
            </button>
          );
        })}
      </div>

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
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-medium text-muted-foreground">
                {t("empty.noMoveOut")}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setStatusFilter("all")}
              >
                {t("common.viewAll")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((r) => {
                const s = getStatusDisplay(r.status);
                const Icon = s.icon;
                return (
                  <div
                    key={r.request_id}
                    className="p-4 border rounded-lg space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">
                          {t("moveout.moveOutDate")}: {fmtDate(r.move_out_date)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("common.created")}: {fmtDate(r.created_at)}
                        </p>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 text-sm font-medium shrink-0 ${s.color}`}
                      >
                        <Icon className="h-4 w-4" />
                        {s.label}
                      </div>
                    </div>

                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs mb-0.5">
                        {t("moveout.reason")}
                      </p>
                      <p className="break-words">{r.reason}</p>
                    </div>

                    {r.admin_note && (
                      <div className="text-sm bg-muted/50 rounded p-2 mt-2">
                        <p className="text-muted-foreground text-xs mb-0.5">
                          {t("common.note")}
                        </p>
                        <p className="break-words">{r.admin_note}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-info/30 bg-info/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-info" />
            {t("common.note")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t("moveout.notice30")}</p>
          <p>{t("moveout.infoFine")}</p>
          <p>{t("moveout.infoRefund")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
