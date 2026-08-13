//settings/page.tsx

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  Building2,
  Zap,
  Droplets,
  Download,
  ShieldAlert,
  QrCode,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { settingsAPI } from "@/lib/api/settings.api";
import { utilityRateAPI } from "@/lib/api/utilityRate.api";
import { reportAPI } from "@/lib/api/report.api";
import { useLanguage } from "@/context/language-context";
import { DatePickerField } from "@/components/common/date-picker-field";

// ── NOTE ─────────────────────────────────────────────────────────
// เพิ่มฟิลด์ PromptPay (promptpay_type, promptpay_id) เข้าไปในแท็บการเงิน
// แทนที่การอ่านจาก process.env.PROMPTPAY_ID เดิม — เพื่อให้ระบบใช้ได้กับ
// หอพักไหนก็ได้โดยไม่ต้องแก้โค้ด/redeploy ตามที่ต้องออกแบบไว้
// ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t, language } = useLanguage();
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dorm");

  /* ── System export ── */
  const [exportingSystem, setExportingSystem] = useState(false);

  /* ── Dorm info ── */
  const [dormName, setDormName] = useState("");
  const [dormAddress, setDormAddress] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [numFloors, setNumFloors] = useState("5");
  const [savingDorm, setSavingDorm] = useState(false);

  /* ── Financial: bank info (แสดงผลในใบแจ้งหนี้เท่านั้น ไม่ใช้สร้าง QR) ── */
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");

  /* ── Financial: PromptPay (ใช้สร้าง Dynamic QR Code จริง) ── */
  const [promptpayType, setPromptpayType] = useState<"phone" | "citizen_id">(
    "phone",
  );
  const [promptpayId, setPromptpayId] = useState("");
  const [savingFinancial, setSavingFinancial] = useState(false);

  /* ── Utility rates ── */
  const [waterBillingType, setWaterBillingType] = useState<"unit" | "flat">(
    "unit",
  );
  const [waterFlatRate, setWaterFlatRate] = useState("");
  const [electricRate, setElectricRate] = useState("");
  const [waterRate, setWaterRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [savingRates, setSavingRates] = useState(false);
  const [currentRates, setCurrentRates] = useState<{
    electric?: any;
    water?: any;
  }>({});

  /* ── Load all ── */
  const loadSettings = useCallback(async () => {
    try {
      setPageLoading(true);
      const [settingsRes, ratesRes] = await Promise.allSettled([
        settingsAPI.getAll(),
        utilityRateAPI.getCurrent(),
      ]);

      if (settingsRes.status === "fulfilled") {
        const s = settingsRes.value?.data ?? settingsRes.value ?? {};
        setDormName(s.dorm_name ?? "");
        setDormAddress(s.dorm_address ?? "");
        setAdminPhone(s.admin_phone ?? "");
        setAdminEmail(s.admin_email ?? "");
        setNumFloors(String(s.num_floors ?? "5"));
        setBankName(s.bank_name ?? "");
        setBankAccount(s.bank_account ?? "");
        setBankAccountName(s.bank_account_name ?? "");
        setPromptpayType(
          (s.promptpay_type as "phone" | "citizen_id") || "phone",
        );
        setPromptpayId(s.promptpay_id ?? "");
        setWaterBillingType(
          (s.water_billing_type as "unit" | "flat") || "unit",
        );
        setWaterFlatRate(String(s.water_flat_rate ?? ""));
      }

      if (ratesRes.status === "fulfilled") {
        const r = ratesRes.value?.data ?? ratesRes.value ?? {};
        setCurrentRates(r);
        setElectricRate(r.electric?.rate_per_unit ?? "");
        setWaterRate(r.water?.rate_per_unit ?? "");
      }
    } catch {
      toast.error(
        language === "th" ? "โหลดข้อมูลไม่สำเร็จ" : "Failed to load settings",
      );
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  /* ── System export ── */
  const handleSystemExport = async () => {
    setExportingSystem(true);
    try {
      await reportAPI.getSystemExport();
      toast.success(
        language === "th" ? "ดาวน์โหลดข้อมูลสำเร็จ" : "Export downloaded",
      );
    } catch {
      toast.error(language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred");
    } finally {
      setExportingSystem(false);
    }
  };

  /* ── Save dorm ── */
  const handleSaveDorm = async () => {
    setSavingDorm(true);
    try {
      await settingsAPI.update({
        dorm_name: dormName,
        dorm_address: dormAddress,
        admin_phone: adminPhone,
        admin_email: adminEmail,
        num_floors: numFloors,
      });
      toast.success(
        language === "th" ? "บันทึกข้อมูลหอพักแล้ว" : "Dorm info saved",
      );
    } catch (err: any) {
      toast.error(
        t(err?.response?.data?.message) ??
          (language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred"),
      );
    } finally {
      setSavingDorm(false);
    }
  };

  /* ── Save financial (bank display info + PromptPay) ── */
  const handleSaveFinancial = async () => {
    setSavingFinancial(true);
    try {
      await settingsAPI.update({
        bank_name: bankName,
        bank_account: bankAccount,
        bank_account_name: bankAccountName,
        promptpay_type: promptpayType,
        promptpay_id: promptpayId,
      });
      if (promptpayId && !/^\d+$/.test(promptpayId)) {
        toast.error(language === "th" ? "หมายเลข PromptPay ต้องเป็นตัวเลขเท่านั้น" : "PromptPay ID must contain only numbers");
        return;
      }
      toast.success(
        language === "th" ? "บันทึกข้อมูลการเงินแล้ว" : "Financial info saved",
      );
    } catch (err: any) {
      const code = err?.response?.data?.message;
      toast.error(
        (code ? t(code) : null) ??
          (language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred"),
      );
    } finally {
      setSavingFinancial(false);
    }
  };

  /* ── Save utility rates ── */
  const handleSaveRates = async () => {
    // 1. ตรวจสอบค่าน้ำให้ถูกเงื่อนไขตามประเภทที่เลือก
    const isWaterValid =
      waterBillingType === "unit" ? !!waterRate : !!waterFlatRate;

    if (!electricRate || !isWaterValid) {
      toast.error(
        language === "th" ? "กรุณากรอกให้ครบ" : "Please fill all fields",
      );
      return;
    }
    setSavingRates(true);
    try {
      const promises: Promise<any>[] = [
        utilityRateAPI.create({
          utility_type: "electric",
          rate_per_unit: parseFloat(electricRate),
          effective_from: effectiveFrom,
        }),
        settingsAPI.update({
          water_billing_type: waterBillingType,
          water_flat_rate:
            waterBillingType === "flat" ? parseFloat(waterFlatRate) || 0 : null,
        }),
      ];
      if (waterBillingType === "unit" && waterRate) {
        promises.push(
          utilityRateAPI.create({
            utility_type: "water",
            rate_per_unit: parseFloat(waterRate),
            effective_from: effectiveFrom,
          }),
        );
      }
      await Promise.all(promises);
      toast.error( // หมายเหตุ: อย่าลืมเช็กตรงนี้ ถ้าโค้ดเดิมเป็น toast.success ก็ใช้ .success นะครับ
        language === "th"
          ? "บันทึกอัตราค่าสาธารณูปโภคแล้ว"
          : "Utility rates saved",
      );
      loadSettings();
    } catch {
      toast.error(language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred");
    } finally {
      setSavingRates(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPromptpayConfigured = !!promptpayId?.trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-2xl font-bold">
            {t("settings.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("settings.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleSystemExport}
          disabled={exportingSystem}
        >
          {exportingSystem ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {language === "th" ? "Export ข้อมูลระบบ" : "Export System Data"}
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        {/* Mobile: Select dropdown */}
        <div className="sm:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dorm">
                🏠 {language === "th" ? "หอพัก" : "Dorm"}
              </SelectItem>
              <SelectItem value="financial">
                💰 {t("settings.tabFinancial")}
              </SelectItem>
              <SelectItem value="utilities">
                ⚡ {language === "th" ? "สาธารณูปโภค" : "Utilities"}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop: Tabs — เหลือ 3 แท็บ (ตัด notifications, telegram ออก) */}
        <TabsList className="hidden sm:grid w-full grid-cols-3">
          <TabsTrigger value="dorm">
            <Building2 className="h-3.5 w-3.5 mr-1.5" />
            {language === "th" ? "หอพัก" : "Dorm"}
          </TabsTrigger>
          <TabsTrigger value="financial">
            {t("settings.tabFinancial")}
          </TabsTrigger>
          <TabsTrigger value="utilities">
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            {language === "th" ? "สาธารณูปโภค" : "Utilities"}
          </TabsTrigger>
        </TabsList>

        {/* ── Dorm Info ── */}
        <TabsContent value="dorm">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {language === "th" ? "ข้อมูลหอพัก" : "Dorm Information"}
              </CardTitle>
              <CardDescription>
                {language === "th"
                  ? "ข้อมูลที่แสดงในบิลและใบเสร็จ"
                  : "Info shown on bills and receipts"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-medium">
                    {language === "th" ? "ชื่อหอพัก" : "Dorm Name"}
                  </label>
                  <Input
                    value={dormName}
                    onChange={(e) => setDormName(e.target.value)}
                    placeholder={
                      language === "th"
                        ? "เช่น หอพักสุขสบาย"
                        : "e.g. Happy Dorm"
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-medium">
                    {language === "th" ? "ที่อยู่" : "Address"}
                  </label>
                  <Textarea
                    value={dormAddress}
                    onChange={(e) => setDormAddress(e.target.value)}
                    placeholder={
                      language === "th" ? "ที่อยู่หอพัก" : "Dorm address"
                    }
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {language === "th" ? "เบอร์ติดต่อ" : "Phone"}
                  </label>
                  <Input
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="0xx-xxx-xxxx"
                    type="tel"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {language === "th" ? "อีเมล" : "Email"}
                  </label>
                  <Input
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@email.com"
                    type="email"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {language === "th" ? "จำนวนชั้น" : "Number of Floors"}
                  </label>
                  <Input
                    value={numFloors}
                    onChange={(e) => setNumFloors(e.target.value)}
                    placeholder="5"
                    type="number"
                    min="1"
                    max="50"
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === "th"
                      ? "ใช้สำหรับ dropdown ชั้นในฟอร์มเพิ่มห้อง"
                      : "Used for floor dropdown when adding rooms"}
                  </p>
                </div>
              </div>
              <Button onClick={handleSaveDorm} disabled={savingDorm}>
                {savingDorm ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {language === "th" ? "บันทึก" : "Save"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Financial ── */}
        <TabsContent value="financial" className="space-y-4">
          {/* PromptPay — ใช้สร้าง Dynamic QR Code จริง */}
          <Card
            className={
              isPromptpayConfigured
                ? "border-primary/30"
                : "border-destructive/40"
            }
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" />
                  {language === "th"
                    ? "ข้อมูลสำหรับสร้าง QR Code (PromptPay)"
                    : "PromptPay (for QR Code generation)"}
                </CardTitle>

                {isPromptpayConfigured ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {language === "th" ? "ตั้งค่าแล้ว" : "Configured"}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {language === "th" ? "ยังไม่ได้ตั้งค่า" : "Not configured"}
                  </span>
                )}
              </div>

              <CardDescription className="flex items-start gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                {language === "th"
                  ? "ข้อมูลนี้ใช้สร้าง QR Code ที่ผู้เช่าสแกนจ่ายจริง กรุณาตรวจสอบให้ถูกต้องก่อนบันทึกทุกครั้ง"
                  : "This is used to generate the actual payment QR code. Please double-check before saving."}
              </CardDescription>

              {!isPromptpayConfigured && (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-2.5 mt-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    {language === "th"
                      ? "ยังไม่ได้ตั้งค่า PromptPay — บิลใหม่ที่สร้างจะไม่มี QR Code ให้ผู้เช่าสแกนจ่าย จนกว่าจะกรอกและบันทึกข้อมูลด้านล่างนี้"
                      : "PromptPay not set — new bills will be created without a QR code until you fill in and save the details below."}
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {language === "th" ? "ประเภท PromptPay" : "PromptPay Type"}
                </label>
                <Select
                  value={promptpayType}
                  onValueChange={(v) => {
                    const type = v as "phone" | "citizen_id";
                    setPromptpayType(type);
                    // ถ้าเปลี่ยนเป็น phone และเลขยาวเกิน 10 หลัก ให้ตัดออก
                    if (type === "phone" && promptpayId.length > 10) {
                      setPromptpayId(promptpayId.slice(0, 10));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">
                      {language === "th" ? "เบอร์โทรศัพท์" : "Phone Number"}
                    </SelectItem>
                    <SelectItem value="citizen_id">
                      {language === "th"
                        ? "เลขบัตรประชาชน / นิติบุคคล"
                        : "Citizen / Corporate ID"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {language === "th" ? "หมายเลข PromptPay" : "PromptPay ID"}
                </label>
                <Input
                  value={promptpayId}
                  onChange={(e) => setPromptpayId(e.target.value)}
                  placeholder={
                    promptpayType === "phone" ? "0812345678" : "1234567890123"
                  }
                  maxLength={promptpayType === "phone" ? 10 : 13}
                />
                <p className="text-xs text-muted-foreground">
                  {promptpayType === "phone"
                    ? language === "th"
                      ? "ตัวเลข 10 หลัก ขึ้นต้นด้วย 0"
                      : "10 digits, starting with 0"
                    : language === "th"
                      ? "ตัวเลข 13 หลัก"
                      : "13 digits"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ข้อมูลธนาคาร — แสดงผลในใบแจ้งหนี้เท่านั้น ไม่ใช้สร้าง QR */}
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.financialTitle")}</CardTitle>
              <CardDescription>
                {language === "th"
                  ? "แสดงในใบแจ้งหนี้ สำหรับผู้เช่าที่โอนผ่านแอปธนาคารแทนการสแกน QR"
                  : "Shown on invoices, for tenants who prefer bank transfer over QR scan"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {t("settings.bankName")}
                </label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder={t("settings.bankName")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {t("settings.bankAccount")}
                </label>
                <Input
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="xxxxxxxxxx"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {t("settings.bankAccountName")}
                </label>
                <Input
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder={t("settings.bankAccountName")}
                />
              </div>
              <Button onClick={handleSaveFinancial} disabled={savingFinancial}>
                {savingFinancial ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {language === "th"
                  ? "บันทึกข้อมูลการเงิน"
                  : "Save Financial Info"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Utilities ── */}
        <TabsContent value="utilities" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">
                    {language === "th"
                      ? "ค่าไฟปัจจุบัน"
                      : "Current Electric Rate"}
                  </span>
                </div>
                <p className="text-2xl font-bold">
                  ฿{currentRates.electric?.rate_per_unit ?? "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === "th" ? "ต่อหน่วย" : "per unit"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">
                    {language === "th"
                      ? "ค่าน้ำปัจจุบัน"
                      : "Current Water Rate"}
                  </span>
                </div>
                <p className="text-2xl font-bold">
                  ฿
                  {waterBillingType === "flat"
                    ? waterFlatRate || "-"
                    : (currentRates.water?.rate_per_unit ?? "-")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {waterBillingType === "flat"
                    ? language === "th"
                      ? "เหมาจ่าย/เดือน"
                      : "flat rate/month"
                    : language === "th"
                      ? "ต่อหน่วย"
                      : "per unit"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {language === "th" ? "ตั้งอัตราใหม่" : "Set New Rates"}
              </CardTitle>
              <CardDescription>
                {language === "th"
                  ? "อัตราใหม่จะมีผลตั้งแต่วันที่กำหนด"
                  : "New rates will apply from the specified date"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-yellow-500" />
                    {language === "th"
                      ? "ค่าไฟ (บาท/หน่วย)"
                      : "Electric (฿/unit)"}
                  </label>
                  <Input
                    value={electricRate}
                    onChange={(e) => setElectricRate(e.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="7.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Droplets className="h-3.5 w-3.5 text-blue-500" />
                    {language === "th" ? "ค่าน้ำ" : "Water"}
                  </label>
                  <div className="flex rounded-md border border-border overflow-hidden text-xs font-medium w-fit">
                    <button
                      type="button"
                      onClick={() => setWaterBillingType("unit")}
                      className={`px-3 py-1.5 transition-colors ${waterBillingType === "unit" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                    >
                      {language === "th" ? "ตามหน่วย" : "Per Unit"}
                    </button>
                    <button
                      onClick={() => setWaterBillingType("flat")}
                      className={`px-3 py-1.5 transition-colors border-l border-border ${waterBillingType === "flat" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                    >
                      {language === "th" ? "เหมาจ่าย" : "Flat Rate"}
                    </button>
                  </div>
                  {waterBillingType === "unit" ? (
                    <Input
                      value={waterRate}
                      onChange={(e) => setWaterRate(e.target.value)}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="18.00"
                    />
                  ) : (
                    <div className="space-y-1">
                      <Input
                        value={waterFlatRate}
                        onChange={(e) => setWaterFlatRate(e.target.value)}
                        type="number"
                        min="0"
                        step="1"
                        placeholder="200"
                      />
                      <p className="text-xs text-muted-foreground">
                        {language === "th"
                          ? "บาท/เดือน (ไม่คิดตามหน่วย)"
                          : "฿/month (regardless of usage)"}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {language === "th" ? "มีผลตั้งแต่" : "Effective From"}
                  </label>
                  {/* เปลี่ยนจาก Input type="date" มาใช้ DatePickerField */}
                  <DatePickerField
                    value={effectiveFrom}
                    onChange={(v) => setEffectiveFrom(v)}
                    language={language}
                  />
                </div>
              </div>
              <Button onClick={handleSaveRates} disabled={savingRates}>
                {savingRates ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {language === "th" ? "บันทึกอัตราใหม่" : "Save New Rates"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
