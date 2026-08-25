//payments/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ImageIcon,
  Loader2,
  Search,
  Wallet,
  CreditCard,
  Calendar,
  DoorClosed,
  Receipt,
  Download,
} from "lucide-react";
import { PaymentStatusBadge } from "@/components/common/status-badge";
import { PaginationFooter } from "@/components/common/pagination-footer";
import { paymentAPI } from "@/lib/api/payment.api";
import { getMediaUrl } from "@/lib/media-url";
import { todayDateString } from "@/lib/utils";
import { toast } from "sonner";
import { useLanguage } from "@/context/language-context";
import { Payment } from "@/types/index";

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(
    amount,
  );

export default function PaymentsPage() {
  const { t } = useLanguage();

  const getMethodLabel = (method: string) =>
    (
      ({
        qr_promptpay: t("payment.methodQR"),
        cash: t("payment.methodCash"),
        bank_transfer: t("payment.methodTransfer"),
      }) as Record<string, string>
    )[method] ?? method;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ total: 0, totalPages: 0 });
  const [statusCounts, setStatusCounts] = useState({
    pending_verify: 0,
    verified: 0,
    rejected: 0,
  });

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page,
        limit: PAGE_SIZE,
      };
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterMethod !== "all") params.payment_method = filterMethod;
      if (searchTerm.trim()) params.search = searchTerm.trim();
      const res = await paymentAPI.getAll(params);
      setPayments(res?.data?.items ?? []);
      setPageMeta({
        total: res?.data?.pagination?.total ?? 0,
        totalPages: res?.data?.pagination?.totalPages ?? 0,
      });
      setStatusCounts(
        res?.data?.statusCounts ?? {
          pending_verify: 0,
          verified: 0,
          rejected: 0,
        },
      );
    } catch {
      toast.error(t("payment.loadError"));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterMethod, searchTerm, page]);

  useEffect(() => {
    const timer = setTimeout(fetchPayments, 300);
    return () => clearTimeout(timer);
  }, [fetchPayments]);

  // เปลี่ยน filter/search แล้วต้องกลับไปหน้า 1 เสมอ
  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterMethod, searchTerm]);

  const handleVerify = async () => {
    if (!selectedPayment) return;
    try {
      setActionLoading(true);
      await paymentAPI.verify(selectedPayment.payment_id);
      toast.success(t("payment.approveSuccess"));
      setDetailsDialogOpen(false);
      setSelectedPayment(null);
      fetchPayments();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("payment.actionError"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedPayment || !rejectReason.trim()) {
      toast.error(t("payment.rejectReasonRequired"));
      return;
    }
    try {
      setActionLoading(true);
      await paymentAPI.reject(selectedPayment.payment_id, rejectReason);
      toast.success(t("payment.rejectSuccess"));
      setRejectDialogOpen(false);
      setDetailsDialogOpen(false);
      setRejectReason("");
      setSelectedPayment(null);
      fetchPayments();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("payment.actionError"));
    } finally {
      setActionLoading(false);
    }
  };

  // ⚠️ filter/search ย้ายไปทำที่ backend แล้ว (ดู payment.model.js) เพื่อให้
  // ถูกต้องข้ามทุกหน้า — ตัวแปรนี้เก็บชื่อเดิมไว้
  const filteredPayments = payments;

  // ⚠️ เดิมนับจาก payments array ที่โหลดมาทั้งหมด พอแบ่งหน้าแล้วจะนับได้แค่
  // ในหน้าปัจจุบัน ไม่ใช่ยอดรวมจริง — ใช้ statusCounts จาก backend แทน
  // (นับรวมทุกหน้า ตาม filter อื่นที่ตั้งไว้ ยกเว้น filterStatus เอง)
  const stats = {
    total:
      statusCounts.pending_verify + statusCounts.verified + statusCounts.rejected,
    pending: statusCounts.pending_verify,
    verified: statusCounts.verified,
    rejected: statusCounts.rejected,
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="w-5 h-5 text-success" />;
      case "rejected":
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return <Clock className="w-5 h-5 text-warning" />;
    }
  };

  const slipUrl = (path: string | null) => getMediaUrl(path, "detail");

  const paidDate = (p: Payment) => p.paid_at;

  const openDetails = (payment: Payment) => {
    setSelectedPayment(payment);
    setDetailsDialogOpen(true);
  };

  // ── Export Excel ─────────────────────────────────────────────
  // ย้ายมา generate ที่ backend แล้ว (GET /api/reports/payments) แทน
  // การสร้างไฟล์ในเบราว์เซอร์ — ส่ง filter เดียวกับที่ตั้งอยู่บนหน้าจอ
  // (status, method, search) ไปให้ backend กรองแทน ได้ข้อมูลตรงจาก DB
  // เสมอ + sanitize กัน Formula Injection ให้แล้วที่ backend (excelSafe)
  // ไม่ต้องทำซ้ำฝั่ง client — เตือนถ้ายังไม่ได้กรองเฉพาะ "verified"
  // เพราะรายการ pending/rejected ไม่ควรถูกนับเป็นรายได้จริงทางบัญชี
  const handleExport = async () => {
    if (filteredPayments.length === 0) {
      toast.error(t("common.noData"));
      return;
    }
    if (filterStatus !== "verified") {
      toast.warning(
        t("payment.exportUnverifiedWarning") ??
          "รายการที่ export รวมสถานะที่ยังไม่ตรวจสอบ/ถูกปฏิเสธด้วย แนะนำกรองเฉพาะ 'ชำระแล้ว' ก่อน export เพื่อความถูกต้องทางบัญชี",
      );
    }

    try {
      setExporting(true);

      const params: Record<string, string> = {};
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterMethod !== "all") params.payment_method = filterMethod;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const dateStamp = todayDateString();
      await paymentAPI.exportExcel(params, `payments_${dateStamp}.xlsx`);

      toast.success(t("payment.exportSuccess", { fmt: "Excel" }) ?? "Export สำเร็จ");
    } catch {
      toast.error(t("payment.exportError") ?? "Export ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  };

  const statCards = [
    {
      labelKey: "paymentVerify.statsTotal",
      value: stats.total,
      icon: Wallet,
      accent: "text-foreground",
      ring: "bg-muted text-foreground",
    },
    {
      labelKey: "paymentVerify.statsPending",
      value: stats.pending,
      icon: Clock,
      accent: "text-warning",
      ring: "bg-warning/10 text-warning",
    },
    {
      labelKey: "paymentVerify.statsVerified",
      value: stats.verified,
      icon: CheckCircle,
      accent: "text-success",
      ring: "bg-success/10 text-success",
    },
    {
      labelKey: "paymentVerify.statsRejected",
      value: stats.rejected,
      icon: XCircle,
      accent: "text-destructive",
      ring: "bg-destructive/10 text-destructive",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-balance">
            {t("payments.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("payments.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exporting || loading || filteredPayments.length === 0}
        >
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {t("payment.exportExcel") ?? "Export Excel"}
        </Button>
      </div>

      {/* Stats: 2x2 on mobile, 4-up on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.labelKey} className="overflow-hidden">
              <CardContent className="p-4 flex items-center gap-3">
                <div
                  className={`hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.ring}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">
                    {t(s.labelKey)}
                  </p>
                  <div
                    className={`text-2xl md:text-3xl font-bold leading-tight mt-0.5 ${s.accent}`}
                  >
                    {s.value}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:gap-4">
            <div className="relative md:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={t("payment.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 md:flex md:gap-4">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder={t("common.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="pending_verify">
                    {t("paymentVerify.statsPending")}
                  </SelectItem>
                  <SelectItem value="verified">
                    {t("paymentVerify.statsVerified")}
                  </SelectItem>
                  <SelectItem value="rejected">
                    {t("paymentVerify.statsRejected")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterMethod} onValueChange={setFilterMethod}>
                <SelectTrigger className="w-full md:w-44">
                  <SelectValue placeholder={t("payment.method")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("payment.allMethods")}</SelectItem>
                  <SelectItem value="qr_promptpay">
                    {t("payment.methodQR")}
                  </SelectItem>
                  <SelectItem value="cash">
                    {t("payment.methodCash")}
                  </SelectItem>
                  <SelectItem value="bank_transfer">
                    {t("payment.methodTransfer")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredPayments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">{t("common.noData")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: table-style header */}
          <Card className="hidden md:block overflow-hidden">
            <div className="grid grid-cols-12 gap-4 border-b bg-muted/40 px-6 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <div className="col-span-4">{t("common.tenant")}</div>
              <div className="col-span-2 text-right">{t("common.amount")}</div>
              <div className="col-span-2">{t("payment.method")}</div>
              <div className="col-span-2">{t("payment.paidDate")}</div>
              <div className="col-span-2 text-right">{t("common.status")}</div>
            </div>
            <div className="divide-y">
              {filteredPayments.map((payment) => (
                <button
                  key={payment.payment_id}
                  type="button"
                  onClick={() => openDetails(payment)}
                  className="grid w-full grid-cols-12 items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="shrink-0">{statusIcon(payment.status)}</div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {payment.tenant_name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {t("contracts.room")} {payment.room_number} •{" "}
                        {t("payment.billNo")} #{payment.bill_id}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-2 text-right font-semibold tabular-nums">
                    {formatCurrency(Number(payment.amount_paid))}
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground truncate">
                    {getMethodLabel(payment.payment_method)}
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground truncate">
                    {formatDate(paidDate(payment))}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <PaymentStatusBadge status={payment.status} />
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Mobile: cards */}
          <div className="space-y-3 md:hidden">
            {filteredPayments.map((payment) => (
              <Card
                key={payment.payment_id}
                className="cursor-pointer transition-colors hover:bg-muted/40 active:bg-muted/60"
                onClick={() => openDetails(payment)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0">
                      {statusIcon(payment.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-base truncate">
                            {payment.tenant_name}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {t("contracts.room")} {payment.room_number} •{" "}
                            {t("payment.billNo")} #{payment.bill_id}
                          </p>
                        </div>
                        <PaymentStatusBadge status={payment.status} />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-lg font-bold tabular-nums">
                          {formatCurrency(Number(payment.amount_paid))}
                        </span>
                        <span className="text-xs bg-muted px-2 py-1 rounded shrink-0">
                          {getMethodLabel(payment.payment_method)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {formatDate(paidDate(payment))}
                      </p>
                      {payment.remark && (
                        <p className="text-sm text-muted-foreground mt-2 italic truncate">
                          {payment.remark}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
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

      {/* Detail Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsDialogOpen(false);
            setSelectedPayment(null);
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("payment.detailTitle")} #{selectedPayment?.payment_id}
            </DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              {/* Amount highlight */}
              <div className="rounded-xl border bg-muted/40 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    {t("common.amount")}
                  </p>
                  <p className="text-2xl font-bold tabular-nums">
                    {formatCurrency(Number(selectedPayment.amount_paid))}
                  </p>
                </div>
                <PaymentStatusBadge status={selectedPayment.status} />
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-4">
                <div className="flex items-start gap-2">
                  <DoorClosed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {t("contracts.tenantName")}
                    </p>
                    <p className="font-medium truncate">
                      {selectedPayment.tenant_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <DoorClosed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {t("contracts.room")}
                    </p>
                    <p className="font-medium truncate">
                      {selectedPayment.room_number}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {t("payment.billNo")} #
                    </p>
                    <p className="font-medium truncate">
                      {selectedPayment.bill_id}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {t("payment.method")}
                    </p>
                    <p className="font-medium truncate">
                      {getMethodLabel(selectedPayment.payment_method)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {t("payment.paidDate")}
                    </p>
                    <p className="font-medium truncate">
                      {formatDate(paidDate(selectedPayment))}
                    </p>
                  </div>
                </div>
                {selectedPayment.verified_at && (
                  <div className="flex items-start gap-2">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">
                        {selectedPayment.status === "verified"
                          ? t("payment.approvedOn")
                          : t("payment.rejectedOn")}
                      </p>
                      <p className="font-medium truncate">
                        {formatDate(selectedPayment.verified_at)}
                      </p>
                    </div>
                  </div>
                )}
                {selectedPayment.verified_by_name && (
                  <div className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">
                        {t("payment.processedBy")}
                      </p>
                      <p className="font-medium truncate">
                        {selectedPayment.verified_by_name}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {selectedPayment.remark && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {t("common.note")}
                  </p>
                  <p className="p-3 bg-muted rounded-lg text-sm italic">
                    {selectedPayment.remark}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">{t("payment.slip")}</p>
                {selectedPayment.slip_image ? (
                  <div className="border rounded-lg overflow-hidden bg-muted/30">
                    <img
                      src={slipUrl(selectedPayment.slip_image) ?? ""}
                      alt={t("payment.slip")}
                      className="w-full max-h-72 object-contain mx-auto"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="p-2 text-center border-t">
                      <Button variant="link" size="sm" asChild>
                        <a
                          href={slipUrl(selectedPayment.slip_image) ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ImageIcon className="mr-1 h-4 w-4" />
                          {t("payment.viewFullImage")}
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted p-4 rounded-lg aspect-video flex flex-col items-center justify-center gap-2">
                    <ImageIcon className="h-8 w-8 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      {t("payment.noSlip")}
                    </p>
                  </div>
                )}
              </div>

              {selectedPayment.status === "pending_verify" && (
                <div className="flex flex-col-reverse gap-3 pt-4 border-t sm:flex-row">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={actionLoading}
                    onClick={() => {
                      setDetailsDialogOpen(false);
                      setRejectDialogOpen(true);
                    }}
                  >
                    <XCircle className="mr-2 w-4 h-4" />
                    {t("payment.reject")}
                  </Button>
                  <Button
                    className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                    disabled={actionLoading}
                    onClick={handleVerify}
                  >
                    {actionLoading ? (
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 w-4 h-4" />
                    )}
                    {t("moveout.approve")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDialogOpen(false);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>{t("payment.rejectDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">
                {t("common.tenant")}
              </p>
              <p className="font-medium">
                {selectedPayment?.tenant_name} — {t("contracts.room")}{" "}
                {selectedPayment?.room_number}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">
                {t("payment.rejectReason")}
              </label>
              <Textarea
                placeholder={t("payment.rejectReasonPlaceholder")}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
            <Button
              onClick={handleRejectSubmit}
              disabled={!rejectReason.trim() || actionLoading}
              variant="destructive"
              className="w-full"
            >
              {actionLoading ? (
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 w-4 h-4" />
              )}
              {t("payment.confirmReject")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
