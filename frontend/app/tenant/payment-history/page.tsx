"use client";

import { useState, useEffect } from "react";
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
  payment_id: number;
  bill_id: number;
  amount_paid: number;
  payment_method: string;
  paid_at: string;
  status: "pending_verify" | "verified" | "rejected";
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

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const methodLabel = (method: string) => {
    const map: Record<string, string> = {
      qr_promptpay: "QR PromptPay",
      cash: language === "th" ? "เงินสด" : "Cash",
      bank_transfer: language === "th" ? "โอนธนาคาร" : "Bank Transfer",
    };
    return map[method] ?? method;
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending_verify: {
      label: t("status.pending_verify"),
      color: "bg-yellow-500/10 text-yellow-600",
    },
    verified: {
      label: t("status.verified"),
      color: "bg-green-500/10 text-green-600",
    },
    rejected: {
      label: t("status.rejected"),
      color: "bg-red-500/10 text-red-600",
    },
  };

  useEffect(() => {
    paymentAPI
      .getMyPayments()
      .then((r) => setPayments(r.data ?? []))
      .catch((err) => {
        // 404 = ยังไม่มีประวัติการชำระ (user ใหม่) — ไม่ต้อง toast
        if (err?.response?.status !== 404) {
          toast.error(t("payment.loadError"));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const months = [...new Set(payments.map((p) => p.paid_at.substring(0, 7)))]
    .sort()
    .reverse();

  const filtered =
    filterMonth === "all"
      ? payments
      : payments.filter((p) => p.paid_at.startsWith(filterMonth));

  const totalPaid = filtered
    .filter((p) => p.status === "verified")
    .reduce((s, p) => s + Number(p.amount_paid), 0);
  const totalAll = filtered.reduce((s, p) => s + Number(p.amount_paid), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("payments.history")}</h1>
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
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("status.verified")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {fmt(totalPaid)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  {t("common.total")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(totalAll)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("common.all")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filtered.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6">
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
              filtered.map((p) => {
                const s = statusConfig[p.status] ?? statusConfig.pending_verify;
                return (
                  <Card key={p.payment_id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4 flex-1">
                          <div className="bg-green-500/10 p-3 rounded-lg h-fit">
                            <FileText className="w-6 h-6 text-green-500" />
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
                          <p className="text-2xl font-bold text-green-500">
                            {fmt(Number(p.amount_paid))}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${s.color}`}
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
