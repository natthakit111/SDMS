//admin/payment-history/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Eye,
  ImageIcon,
  Loader2,
  TrendingUp,
  Download,
} from "lucide-react";
import { PaymentStatusBadge } from "@/components/common/status-badge";
import { paymentAPI } from "@/lib/api/payment.api";
import { reportAPI } from "@/lib/api/report.api";
import { toast } from "sonner";
import { useLanguage } from "@/context/language-context";
import { Payment } from "@/types/index";


const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(
    amount,
  );

export default function PaymentHistoryPage() {
  const { t } = useLanguage();
  const MONTHS = Array.from({ length: 12 }, (_, i) => t(`month.${i + 1}`));
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
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    String(now.getMonth() + 1),
  );
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await paymentAPI.getAll({ status: "verified" });
      setPayments(res?.data ?? res ?? []);
    } catch {
      toast.error(t("payment.loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const filteredPayments = payments.filter((p) => {
    const d = new Date(p.verified_at ?? p.created_at);
    const matchMonth = d.getMonth() + 1 === Number(selectedMonth);
    const matchYear = d.getFullYear() === Number(selectedYear);
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      p.tenant_name?.toLowerCase().includes(q) ||
      p.room_number?.toLowerCase().includes(q) ||
      String(p.bill_id).includes(q);
    return matchMonth && matchYear && matchSearch;
  });

  const totalRevenue = filteredPayments.reduce(
    (sum, p) => sum + Number(p.amount_paid),
    0,
  );

  const handleExport = async (format: "excel" | "pdf") => {
    try {
      setExporting(true);
      await reportAPI.getPayments(
        Number(selectedMonth),
        Number(selectedYear),
        format,
      );
      toast.success(
        t("payment.exportSuccess").replace("{fmt}", format.toUpperCase()),
      );
    } catch {
      toast.error(t("payment.exportError"));
    } finally {
      setExporting(false);
    }
  };

  const slipUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `${process.env.NEXT_PUBLIC_API_URL ?? ""}/${path}`;
  };

  const years = Array.from({ length: 5 }, (_, i) =>
    String(now.getFullYear() - i),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("paymentHistory.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("paymentHistory.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => handleExport("excel")}
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => handleExport("pdf")}
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            PDF
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("paymentHistory.statsMonthly")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredPayments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("paymentHistory.statsRevenue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(totalRevenue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("paymentHistory.statsAll")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder={t("payment.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {Number(y) + 543}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPayments.map((payment) => (
            <Card key={payment.payment_id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4 flex-1">
                    <div className="mt-1">
                      <CheckCircle className="w-5 h-5 text-success" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-bold text-lg">
                            {payment.tenant_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t("contracts.room")} {payment.room_number} •{" "}
                            {t("payment.billNo")} #{payment.bill_id}
                          </p>
                          <div className="flex gap-2 mt-3 flex-wrap">
                            <span className="text-xs bg-muted px-2 py-1 rounded font-medium">
                              {Number(payment.amount_paid).toLocaleString(
                                "th-TH",
                              )}{" "}
                              {t("contracts.baht")}
                            </span>
                            <span className="text-xs bg-muted px-2 py-1 rounded">
                              {getMethodLabel(payment.payment_method)}
                            </span>
                            <span className="text-xs bg-muted px-2 py-1 rounded">
                              {t("payment.paidOn")}{" "}
                              {formatDate(payment.created_at)}
                            </span>
                            {payment.verified_at && (
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {t("payment.approvedOn")}{" "}
                                {formatDate(payment.verified_at)}
                              </span>
                            )}
                          </div>
                          {payment.verified_by_name && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("payment.approvedBy")}{" "}
                              {payment.verified_by_name}
                            </p>
                          )}
                        </div>
                        <PaymentStatusBadge status={payment.status} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => {
                        setSelectedPayment(payment);
                        setDetailsDialogOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {t("common.view")}
                      </span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredPayments.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  {t("paymentHistory.notFound")}{" "}
                  {MONTHS[Number(selectedMonth) - 1]}{" "}
                  {Number(selectedYear) + 543}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("payment.detailTitle")} #{selectedPayment?.payment_id}
            </DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("contracts.tenantName")}
                  </p>
                  <p className="font-medium">{selectedPayment.tenant_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("contracts.room")}
                  </p>
                  <p className="font-medium">{selectedPayment.room_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("payment.billNo")} #
                  </p>
                  <p className="font-medium">{selectedPayment.bill_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("common.amount")}
                  </p>
                  <p className="font-bold text-lg">
                    {formatCurrency(Number(selectedPayment.amount_paid))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("payment.method")}
                  </p>
                  <p className="font-medium">
                    {getMethodLabel(selectedPayment.payment_method)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("payment.paidDate")}
                  </p>
                  <p className="font-medium">
                    {formatDate(selectedPayment.created_at)}
                  </p>
                </div>
                {selectedPayment.verified_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("payment.approvedOn")}
                    </p>
                    <p className="font-medium">
                      {formatDate(selectedPayment.verified_at)}
                    </p>
                  </div>
                )}
                {selectedPayment.verified_by_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("payment.approvedBy")}
                    </p>
                    <p className="font-medium">
                      {selectedPayment.verified_by_name}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium mb-2">{t("payment.slip")}</p>
                {selectedPayment.slip_image ? (
                  <div className="border rounded-lg overflow-hidden bg-muted/30">
                    <img
                      src={slipUrl(selectedPayment.slip_image) ?? ""}
                      alt={t("payment.slip")}
                      className="w-full max-h-72 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="p-2 text-center">
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
                  <div className="bg-muted p-4 rounded-lg aspect-video flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      {t("payment.noSlip")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
