//tenant/payment/page..tsx

"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BillStatusBadge } from "@/components/common/status-badge";
import {
  QrCode,
  Upload,
  Loader2,
  CheckCircle,
  CreditCard,
  Copy,
  Check,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useLanguage } from "@/context/language-context";
import { billAPI } from "@/lib/api/bill.api";
import { paymentAPI } from "@/lib/api/payment.api";
import { toast } from "sonner";

interface Bill {
  bill_id: number;
  bill_month: number;
  bill_year: number;
  total_amount: number;
  due_date: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  room_number: string;
  qr_payload: string | null;
}

// ── ข้อมูล QR + ธนาคาร ที่ได้จาก GET /bills/:id/qr ──
// backend แนบ bank_name / bank_account / bank_account_name มาด้วย
// (อ่านจาก dorm_settings) สำหรับผู้เช่าที่อยากโอนผ่านแอปธนาคารแทนสแกน QR
interface QrData {
  qr_payload: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_account_name?: string | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);

// จัดกลุ่มเลขบัญชีให้อ่านง่ายขึ้น (ไม่ใช่ format มาตรฐานตายตัวของทุกธนาคาร
// แต่ช่วยให้เลขยาวๆ ไม่ติดกันเป็นพรืด)
const formatBankAccount = (acc: string) => {
  if (!acc) return "";
  // รูปแบบมาตรฐานที่พบบ่อย: x-x-xxxxx-x (10 หลัก)
  if (acc.length === 10) {
    return `${acc.slice(0, 3)}-${acc.slice(3, 4)}-${acc.slice(4, 9)}-${acc.slice(9)}`;
  }
  // ความยาวอื่น (เช่นเลขทดสอบที่ยาวผิดปกติ) — โชว์ดิบๆ ไม่เดา format
  // ดีกว่าหั่นมั่วแล้วดูเป็นเลขบัญชีปลอมๆ
  return acc;
};

export default function TenantPaymentPage() {
  const { t, language } = useLanguage();
  const searchParams = useSearchParams();
  const billIdFromUrl = searchParams.get("bill");

  const [bills, setBills] = useState<Bill[]>([]);
  const [pendingPaymentBillIds, setPendingPaymentBillIds] = useState<
    Set<number>
  >(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedBillId, setSelectedBillId] = useState<string>("");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [slipDialogOpen, setSlipDialogOpen] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  // โหลดบิล + payments พร้อมกัน
  const loadData = async () => {
    try {
      const [billRes, paymentRes] = await Promise.all([
        billAPI.getMyBills(),
        paymentAPI.getMyPayments().catch(() => ({ data: [] })),
      ]);
      const billData: Bill[] = billRes.data ?? [];
      setBills(billData);

      // เก็บ bill_id ที่มี payment รอตรวจสอบอยู่แล้ว
      const payments: any[] = paymentRes.data ?? [];
      const pendingIds = new Set<number>(
        payments
          .filter((p) => p.status === "pending_verify")
          .map((p) => Number(p.bill_id)),
      );
      setPendingPaymentBillIds(pendingIds);

      // auto-select บิลที่ยังชำระได้
      const actionable = billData.filter(
        (b) =>
          (b.status === "pending" || b.status === "overdue") &&
          !pendingIds.has(b.bill_id),
      );
      if (billIdFromUrl) {
        setSelectedBillId(billIdFromUrl);
      } else if (actionable.length > 0) {
        setSelectedBillId(String(actionable[0].bill_id));
      }
    } catch (err: any) {
      if (err?.response?.status !== 404) {
        toast.error(t("payment.loadError"));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [billIdFromUrl]);

  const pendingBills = bills.filter(
    (b) => b.status === "pending" || b.status === "overdue",
  );
  // บิลที่ยังชำระได้ = ยังไม่มีสลิป pending_verify
  const actionableBills = pendingBills.filter(
    (b) => !pendingPaymentBillIds.has(b.bill_id),
  );
  const totalDue = pendingBills.reduce((s, b) => s + Number(b.total_amount), 0);
  const selectedBill = bills.find((b) => String(b.bill_id) === selectedBillId);

  const handleOpenQR = async () => {
    if (!selectedBill) {
      toast.error(t("tenant.payment.selectBill"));
      return;
    }
    try {
      const res = await billAPI.getQR(selectedBill.bill_id);
      setQrData(res.data ?? null);
      setQrDialogOpen(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("payment.loadError"));
    }
  };

  const handleCopyAccount = async (acc: string) => {
    try {
      await navigator.clipboard.writeText(acc);
      setCopiedAccount(true);
      toast.success(
        language === "th" ? "คัดลอกเลขบัญชีแล้ว" : "Account number copied",
      );
      setTimeout(() => setCopiedAccount(false), 2000);
    } catch {
      toast.error(language === "th" ? "คัดลอกไม่สำเร็จ" : "Copy failed");
    }
  };

  const handleSlipUpload = async () => {
    if (!slipFile || !selectedBillId) return;
    setUploading(true);
    try {
      await paymentAPI.submit(selectedBillId, slipFile, "qr_promptpay");
      setUploadDone(true);
      toast.success(t("payment.success.submitted"));
      setTimeout(async () => {
        setSlipDialogOpen(false);
        setUploadDone(false);
        setSlipFile(null);
        setLoading(true);
        await loadData();
      }, 2000);
    } catch (err: any) {
      const data = err?.response?.data;
      const errorCode: string | undefined = data?.error_code;
      toast.error(
        errorCode ? t(errorCode) : (data?.message ?? t("payment.actionError")),
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("tenant.payment.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("tenant.payment.subtitle")}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("payments.totalDue")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(totalDue)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingBills.length} {t("bills.list")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("common.all")} {t("bills.list")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{bills.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("status.paid")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {bills.filter((b) => b.status === "paid").length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ไม่มีบิลค้างชำระเลย */}
          {pendingBills.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                <p className="font-medium text-muted-foreground">
                  {t("empty.noBills")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("empty.noBillsDesc")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Select Bill — แสดงเฉพาะบิลที่ชำระได้ */}
              {actionableBills.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("tenant.payment.selectBill")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select
                      value={selectedBillId}
                      onValueChange={setSelectedBillId}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("tenant.payment.selectBill")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {actionableBills.map((b) => (
                          <SelectItem key={b.bill_id} value={String(b.bill_id)}>
                            {t(`month.${b.bill_month}`)} {b.bill_year} —{" "}
                            {fmt(b.total_amount)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedBill && (
                      <div className="text-sm text-muted-foreground">
                        {t("bills.dueDate")} {fmtDate(selectedBill.due_date)} •{" "}
                        {t("bills.totalAmount")}{" "}
                        <span className="font-bold text-foreground">
                          {fmt(selectedBill.total_amount)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Payment Methods */}
              {actionableBills.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("tenant.payment.methods")}</CardTitle>
                    <CardDescription>
                      {t("tenant.payment.afterPay")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    {/* QR */}
                    <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
                      <Button
                        variant="outline"
                        className="h-24 flex flex-col gap-2"
                        onClick={handleOpenQR}
                        disabled={!selectedBillId}
                      >
                        <QrCode className="w-6 h-6" />
                        <span>{t("payments.qr")}</span>
                        <span className="text-xs text-muted-foreground">
                          PromptPay
                        </span>
                      </Button>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("payments.qr")}</DialogTitle>
                          <DialogDescription>
                            {t("tenant.payment.methods")}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="bg-white p-6 rounded-lg flex items-center justify-center">
                            {qrData?.qr_payload ? (
                              <QRCodeSVG value={qrData.qr_payload} size={240} />
                            ) : (
                              <QrCode className="w-48 h-48 text-gray-800" />
                            )}
                          </div>
                          {selectedBill && (
                            <p className="text-center font-bold text-lg">
                              {fmt(selectedBill.total_amount)}
                            </p>
                          )}

                          {/* ข้อมูลธนาคาร — โชว์เฉพาะเมื่อ admin ตั้งค่าไว้ */}
                          {qrData?.bank_account && (
                            <div className="border-t pt-4 space-y-2">
                              <p className="text-xs text-muted-foreground text-center">
                                {language === "th"
                                  ? "หรือโอนผ่านแอปธนาคาร"
                                  : "Or transfer via bank app"}
                              </p>
                              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                                <div className="min-w-0">
                                  {qrData.bank_name && (
                                    <p className="text-sm font-medium truncate">
                                      {qrData.bank_name}
                                    </p>
                                  )}
                                  <p className="text-sm font-mono">
                                    {formatBankAccount(qrData.bank_account)}
                                  </p>
                                  {qrData.bank_account_name && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {qrData.bank_account_name}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0"
                                  onClick={() =>
                                    handleCopyAccount(qrData.bank_account!)
                                  }
                                >
                                  {copiedAccount ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}

                          <p className="text-sm text-muted-foreground text-center">
                            {t("tenant.payment.afterPay")}
                          </p>
                          <Button
                            onClick={() => setQrDialogOpen(false)}
                            className="w-full"
                          >
                            {t("common.close")}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Upload Slip */}
                    <Dialog
                      open={slipDialogOpen}
                      onOpenChange={setSlipDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-24 flex flex-col gap-2"
                          disabled={!selectedBillId}
                        >
                          <Upload className="w-6 h-6" />
                          <span>{t("payments.slip")}</span>
                          <span className="text-xs text-muted-foreground">
                            JPG/PNG
                          </span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("payments.slip")}</DialogTitle>
                          <DialogDescription>
                            {t("tenant.payment.afterPay")}
                          </DialogDescription>
                        </DialogHeader>
                        {uploadDone ? (
                          <div className="text-center py-8">
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                            <p className="font-medium">
                              {t("payment.success.submitted")}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {t("status.pending_verify")}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <label
                              htmlFor="slip-upload"
                              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted block"
                            >
                              <Input
                                id="slip-upload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) =>
                                  setSlipFile(e.target.files?.[0] ?? null)
                                }
                              />
                              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="font-medium">
                                {slipFile?.name ?? t("common.upload")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                JPG, PNG
                              </p>
                            </label>
                            <Button
                              onClick={handleSlipUpload}
                              disabled={!slipFile || uploading}
                              className="w-full"
                            >
                              {uploading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              {t("common.confirm")}
                            </Button>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              ) : (
                // ทุกบิลมีสลิปรอตรวจสอบแล้ว
                <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                  <CardContent className="py-6 text-center">
                    <CheckCircle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                    <p className="font-medium">{t("status.pending_verify")}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("payment.error.pendingVerify")}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* รายการบิลค้างชำระ */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("bills.list")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingBills.map((b) => (
                      <div
                        key={b.bill_id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {t(`month.${b.bill_month}`)} {b.bill_year}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t("bills.dueDate")} {fmtDate(b.due_date)}
                          </p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <p className="font-bold">{fmt(b.total_amount)}</p>
                          {pendingPaymentBillIds.has(b.bill_id) ? (
                            <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                              {t("status.pending_verify")}
                            </span>
                          ) : (
                            <BillStatusBadge status={b.status} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}