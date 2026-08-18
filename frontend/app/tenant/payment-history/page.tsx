// app/tenant/payment-history/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, TrendingUp, Loader2 } from "lucide-react";
import { paymentAPI } from "@/lib/api/payment.api";
import { useLanguage } from "@/context/language-context";
import { toast } from "sonner";

interface Payment {
  amount_paid: number;
  payment_id: number;
  bill_id: number;
  payment_method: string;
  paid_at: string;
  status: "pending_verify" | "verified" | "rejected" | "partial" | "reserved";
  remark: string | null;
  bill_month?: number;
  bill_year?: number;
  room_number?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);

export default function TenantPaymentHistoryPage() {
  const { t, language } = useLanguage();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState("all");
  const [includeRejected, setIncludeRejected] = useState(false);

  const fmtDate = (d?: string) => {
    if (!d) return "-";
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const methodLabel = (method: string) => {
    const map: Record<string, string> = {
      qr_promptpay: "QR PromptPay",
      cash: language === "th" ? "เงินสด" : "Cash",
      bank_transfer: language === "th" ? "โอนธนาคาร" : "Bank Transfer",
    };
    return map[method] ?? method;
  };

  const statusConfig: Record<
    Payment["status"],
    { label: string; badgeColor: string; amountColor: string }
  > = {
    pending_verify: {
      label: t("status.pending_verify"),
      badgeColor: "bg-warning/10 text-warning",
      amountColor: "text-warning",
    },
    verified: {
      label: t("status.verified"),
      badgeColor: "bg-success/10 text-success",
      amountColor: "text-success",
    },
    rejected: {
      label: t("status.rejected"),
      badgeColor: "bg-destructive/10 text-destructive",
      amountColor: "text-destructive",
    },
    partial: {
      label: t("status.partial") ?? "Partial",
      badgeColor: "bg-info/10 text-info",
      amountColor: "text-info",
    },
    reserved: {
      label: t("status.reserved") ?? "Reserved",
      badgeColor: "bg-info/10 text-info",
      amountColor: "text-info",
    },
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    paymentAPI
      .getMyPayments()
      .then((r) => {
        const raw = r.data ?? [];
        const normalized: Payment[] = raw.map((p: any) => ({
          amount_paid: Number(p.amount_paid) || 0,
          payment_id: p.payment_id,
          bill_id: p.bill_id,
          payment_method: p.payment_method,
          paid_at: p.paid_at ?? "",
          status: p.status,
          remark: p.remark ?? null,
          bill_month: p.bill_month,
          bill_year: p.bill_year,
          room_number: p.room_number,
        }));
        if (mounted) setPayments(normalized);
      })
      .catch((err) => {
        if (err?.response?.status !== 404) {
          if (mounted) toast.error(t("payment.loadError"));
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [t]);

  const months = useMemo(() => {
    const setMonths = new Set<string>();
    for (const p of payments) {
      const m = p.paid_at?.substring(0, 7);
      if (m) setMonths.add(m);
    }
    return Array.from(setMonths).sort().reverse();
  }, [payments]);

  const filtered = useMemo(() => {
    return filterMonth === "all"
      ? payments
      : payments.filter((p) => p.paid_at.startsWith(filterMonth));
  }, [payments, filterMonth]);

  const totalPaid = useMemo(() => {
    return filtered
      .filter((p) => p.status === "verified")
      .reduce((s, p) => s + Number(p.amount_paid), 0);
  }, [filtered]);

  const totalAll = useMemo(() => {
    return filtered
      .filter((p) => (includeRejected ? true : p.status !== "rejected"))
      .reduce((s, p) => s + Number(p.amount_paid), 0);
  }, [filtered, includeRejected]);

  const countAll = useMemo(() => {
    return filtered.filter((p) => (includeRejected ? true : p.status !== "rejected"))
      .length;
  }, [filtered, includeRejected]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("payments.history")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("paymentHistory.subtitle")}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : payments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-14 w-14 text-muted-foreground mb-4 opacity-40" />
            <p className="font-medium text-muted-foreground">
              {t("empty.noPayments")}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("empty.noPaymentsDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  {t("status.verified")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-lg sm:text-2xl font-bold text-success truncate">
                  {fmt(totalPaid)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1 truncate">
                  <TrendingUp className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t("common.total")}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-lg sm:text-2xl font-bold truncate">
                  {fmt(totalAll)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {includeRejected
                    ? (t("paymentHistory.totalIncludesRejected") ??
                      "รวมรายการทั้งหมด")
                    : (t("paymentHistory.totalExcludesRejected") ??
                      "ไม่รวมรายการที่ถูกปฏิเสธ")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  {t("common.all")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-lg sm:text-2xl font-bold">{countAll}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {includeRejected
                    ? (t("paymentHistory.countIncludesRejected") ??
                      "รวมทุกสถานะ")
                    : (t("paymentHistory.countExcludesRejected") ??
                      "ไม่รวมรายการที่ถูกปฏิเสธ")}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder={t("common.all")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    {months.map((m) => {
                      const d = new Date(m + "-01");
                      return (
                        <SelectItem key={m} value={m}>
                          {d.toLocaleDateString(
                            language === "th" ? "th-TH" : "en-GB",
                            { month: "long", year: "numeric" },
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeRejected}
                      onChange={(e) => setIncludeRejected(e.target.checked)}
                      aria-label={
                        includeRejected
                          ? "รวมรายการที่ถูกปฏิเสธ"
                          : "ไม่รวมรายการที่ถูกปฏิเสธ"
                      }
                      className="h-4 w-4"
                    />
                    <span className="text-sm">
                      {t("paymentHistory.includeRejected") ??
                        "รวมรายการที่ถูกปฏิเสธ"}
                    </span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    {t("empty.noPayments")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filtered
                .filter((p) =>
                  includeRejected ? true : p.status !== "rejected",
                )
                .map((p) => {
                  const s =
                    statusConfig[p.status] ?? statusConfig.pending_verify;
                  return (
                    <Card key={p.payment_id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-4 flex-1">
                            <div
                              className={`p-3 rounded-lg h-fit ${
                                p.status === "verified"
                                  ? "bg-success/10"
                                  : p.status === "rejected"
                                    ? "bg-destructive/10"
                                    : "bg-muted"
                              }`}
                            >
                              <FileText
                                className={`w-6 h-6 ${
                                  p.status === "verified"
                                    ? "text-success"
                                    : p.status === "rejected"
                                      ? "text-destructive"
                                      : "text-muted-foreground"
                                }`}
                              />
                            </div>
                            <div>
                              <p className="font-bold">
                                {t("bills.list")} #{p.bill_id}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <span className="text-xs bg-muted px-2 py-1 rounded">
                                  {methodLabel(p.payment_method)}
                                </span>
                                <span className="text-xs bg-muted px-2 py-1 rounded">
                                  {fmtDate(p.paid_at)}
                                </span>
                              </div>
                              {p.remark && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {p.remark}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p
                              className={`text-2xl font-bold ${s.amountColor}`}
                            >
                              {fmt(Number(p.amount_paid))}
                            </p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${s.badgeColor}`}
                            >
                              {s.label}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
            )}
          </div>
        </>
      )}
    </div>
  );
}
