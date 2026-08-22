//tenant/contract/page.tsx

"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Download } from "lucide-react";
import { contractAPI } from "@/lib/api/contract.api";
import { parseBlobErrorMessage } from "@/lib/api/axiosInstance";
import { useLanguage } from "@/context/language-context";
import { toast } from "sonner";

interface Contract {
  contract_id: number;
  room_number: string;
  tenant_name: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  deposit_amount: number;
  status: "active" | "expired" | "terminated";
  note: string | null;
  contract_file: string | null;
}

export default function TenantContractPage() {
  const { t, language } = useLanguage();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      maximumFractionDigits: 0,
    }).format(n);

  const statusConfig: Record<string, { label: string; color: string }> = {
    active: {
      label: t("status.active"),
      color: "bg-success/20 text-success",
    },
    expired: {
      label: t("status.expired"),
      color: "bg-destructive/10 text-destructive",
    },
    terminated: {
      label: t("status.terminated"),
      color: "bg-muted text-muted-foreground",
    },
  };

  useEffect(() => {
    contractAPI
      .getMyContract()
      .then((r) => setContract(r.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async () => {
    if (!contract) return;

    // ยังไม่มีไฟล์จริง — ไม่ต้องเรียก API เลย บอก user ตรงๆ
    if (!contract.contract_file) {
      toast.error(t("tenant.contract.noFileYetDesc"));
      return;
    }

    setDownloading(true);
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
      toast.error(msg ?? t("tenant.contract.downloadError"));
    } finally {
      setDownloading(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        {t("common.loading")}
      </div>
    );

  if (!contract)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("tenant.contract.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("tenant.contract.subtitle")}
          </p>
        </div>
        <Card>
          <CardContent className="pt-10 text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">{t("tenant.contract.none")}</p>
          </CardContent>
        </Card>
      </div>
    );

  const s = statusConfig[contract.status] ?? statusConfig.expired;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("tenant.contract.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("tenant.contract.subtitle")}
        </p>
      </div>

      <Card className="border-primary/50 bg-primary/5 max-w-2xl">
        <CardHeader>
          {/* ✅ FIX: flex-wrap + gap-2 กันชนกันบนจอแคบมาก + shrink-0 ที่ badge
              กันไม่ให้ label ยาวบีบจนแถบ CNT id ถูกอัดจนอ่านยาก */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>{t("tenant.contract.current")}</CardTitle>
              <CardDescription>
                CNT{String(contract.contract_id).padStart(3, "0")}
              </CardDescription>
            </div>
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full shrink-0 ${s.color}`}
            >
              {s.label}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Hero: ค่าเช่า */}
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">
              {t("tenant.rentPerMonth")}
            </p>
            <p className="text-3xl font-bold text-primary mt-1">
              {fmtCurrency(contract.rent_amount)}
            </p>
          </div>

          {/* Detail list */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("rooms.roomNumber")}
              </span>
              <span className="text-sm font-medium">
                {contract.room_number}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("contracts.startDate")}
              </span>
              <span className="text-sm font-medium">
                {fmtDate(contract.start_date)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("contracts.endDate")}
              </span>
              <span className="text-sm font-medium">
                {fmtDate(contract.end_date)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("contracts.deposit")}
              </span>
              <span className="text-sm font-medium text-yellow-600">
                {fmtCurrency(contract.deposit_amount)}
              </span>
            </div>
            {contract.note && (
              <div className="flex items-start justify-between gap-4 pt-1">
                <span className="text-sm text-muted-foreground shrink-0">
                  {t("common.note")}
                </span>
                <span className="text-sm text-right">{contract.note}</span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            {/* ปุ่ม Download เดิม — ไม่ต้องแก้ */}
            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full sm:w-auto min-h-[44px]"
            >
              {downloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("tenant.contract.downloading")}
                </>
              ) : contract?.contract_file ? (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t("tenant.contract.download")}
                </>
              ) : (
                <>{t("tenant.contract.noFileYet")}</>
              )}
            </Button>
            {!contract.contract_file && (
              <p className="text-xs text-muted-foreground mt-2">
                {t("tenant.contract.noFileYetDesc")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
