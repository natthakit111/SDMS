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
      color: "bg-green-500/20 text-green-500",
    },
    expired: {
      label: t("status.expired"),
      color: "bg-red-500/10 text-red-500",
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

    // มีไฟล์สัญญาจริงในระบบ (admin อัปโหลดไว้แล้ว) → ดาวน์โหลดไฟล์จริง
    if (contract.contract_file) {
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
      } catch {
        toast.error(t("tenant.contract.downloadError"));
      } finally {
        setDownloading(false);
      }
      return;
    }

    // fallback: ยังไม่มีไฟล์อัปโหลด → สร้างสรุปข้อมูลเป็น .txt แทน
    const s = statusConfig[contract.status] ?? statusConfig.expired;
    const text = [
      t("tenant.contract.title"),
      "",
      `${t("common.name")}: ${contract.tenant_name}`,
      `${t("rooms.roomNumber")}: ${contract.room_number}`,
      `${t("contracts.startDate")}: ${fmtDate(contract.start_date)}`,
      `${t("contracts.endDate")}: ${fmtDate(contract.end_date)}`,
      `${t("tenant.rentPerMonth")}: ${fmtCurrency(contract.rent_amount)}`,
      `${t("contracts.deposit")}: ${fmtCurrency(contract.deposit_amount)}`,
      `${t("common.status")}: ${s.label}`,
      contract.note ? `${t("common.note")}: ${contract.note}` : "",
    ].join("\n");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = `contract_CNT${String(contract.contract_id).padStart(3, "0")}.txt`;
    a.click();
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
          <h1 className="text-3xl font-bold">{t("tenant.contract.title")}</h1>
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
        <h1 className="text-3xl font-bold">{t("tenant.contract.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("tenant.contract.subtitle")}
        </p>
      </div>

      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("tenant.contract.current")}</CardTitle>
              <CardDescription>
                CNT{String(contract.contract_id).padStart(3, "0")}
              </CardDescription>
            </div>
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full ${s.color}`}
            >
              {s.label}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("rooms.roomNumber")}
              </p>
              <p className="text-2xl font-bold">{contract.room_number}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("tenant.rentPerMonth")}
              </p>
              <p className="text-2xl font-bold text-primary">
                {fmtCurrency(contract.rent_amount)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("contracts.startDate")}
              </p>
              <p className="text-lg font-semibold">
                {fmtDate(contract.start_date)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("contracts.endDate")}
              </p>
              <p className="text-lg font-semibold">
                {fmtDate(contract.end_date)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("contracts.deposit")}
              </p>
              <p className="text-lg font-semibold text-yellow-600">
                {fmtCurrency(contract.deposit_amount)}
              </p>
            </div>
            {contract.note && (
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("common.note")}
                </p>
                <p className="text-sm">{contract.note}</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="gap-2"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t("common.download")}
            </Button>
            {!contract.contract_file && (
              <p className="text-xs text-muted-foreground mt-2">
                {t("tenant.contract.noFileYet")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
