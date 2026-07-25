//settings/page.tsx

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Save,
  Send,
  Copy,
  Check,
  Loader2,
  Building2,
  Zap,
  Droplets,
  LinkIcon,
  Unlink,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Bell,
  Download,
} from "lucide-react";
import { settingsAPI } from "@/lib/api/settings.api";
import { utilityRateAPI } from "@/lib/api/utilityRate.api";
import { reportAPI } from "@/lib/api/report.api";
import api from "@/lib/api/axiosInstance";
import { useLanguage } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";

const telegramAPI = {
  getStatus: () => api.get("/telegram/status"),
  generateLink: () => api.post("/telegram/generate-link"),
  unlink: () => api.delete("/telegram/unlink"),
  broadcast: (message: string) => api.post("/telegram/broadcast", { message }),
};

export default function SettingsPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
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

  /* ── Financial ── */
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [savingFinancial, setSavingFinancial] = useState(false);

  /* ── Notifications ── */
  const [notifyPayment, setNotifyPayment] = useState(true);
  const [notifyMaintenance, setNotifyMaintenance] = useState(true);
  const [notifyOverdue, setNotifyOverdue] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);

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

  /* ── Telegram ── */
  const [tgLinked, setTgLinked] = useState(false);
  const [tgChatId, setTgChatId] = useState<string | null>(null);
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(null);
  const [tgLinkLoading, setTgLinkLoading] = useState(false);
  const [tgPolling, setTgPolling] = useState(false);
  const [tgUnlinkLoading, setTgUnlinkLoading] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "";

  /* ── Load all ── */
  const loadSettings = useCallback(async () => {
    try {
      setPageLoading(true);
      const [settingsRes, ratesRes, tgRes] = await Promise.allSettled([
        settingsAPI.getAll(),
        utilityRateAPI.getCurrent(),
        telegramAPI.getStatus(),
      ]);

      if (settingsRes.status === "fulfilled") {
        const s = settingsRes.value?.data ?? settingsRes.value ?? {};
        setDormName(s.dorm_name ?? "");
        setDormAddress(s.dorm_address ?? "");
        setAdminPhone(s.admin_phone ?? "");
        setAdminEmail(s.admin_email ?? "");
        setNumFloors(s.num_floors ?? "5");
        setBankName(s.bank_name ?? "");
        setBankAccount(s.bank_account ?? "");
        setBankAccountName(s.bank_account_name ?? "");
        setNotifyPayment(s.notify_payment !== "0");
        setNotifyMaintenance(s.notify_maintenance !== "0");
        setNotifyOverdue(s.notify_overdue !== "0");
        setWaterBillingType(
          (s.water_billing_type as "unit" | "flat") || "unit",
        );
        setWaterFlatRate(s.water_flat_rate ?? "");
      }

      if (ratesRes.status === "fulfilled") {
        const r = ratesRes.value?.data ?? ratesRes.value ?? {};
        setCurrentRates(r);
        setElectricRate(r.electric?.rate_per_unit ?? "");
        setWaterRate(r.water?.rate_per_unit ?? "");
      }

      if (tgRes.status === "fulfilled") {
        const tg = tgRes.value?.data?.data ?? {};
        setTgLinked(!!tg.linked);
        setTgChatId(tg.chat_id ?? null);
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
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
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
    } catch {
      toast.error(language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred");
    } finally {
      setSavingDorm(false);
    }
  };

  /* ── Save financial ── */
  const handleSaveFinancial = async () => {
    setSavingFinancial(true);
    try {
      await settingsAPI.update({
        bank_name: bankName,
        bank_account: bankAccount,
        bank_account_name: bankAccountName,
      });
      toast.success(
        language === "th" ? "บันทึกข้อมูลธนาคารแล้ว" : "Bank info saved",
      );
    } catch {
      toast.error(language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred");
    } finally {
      setSavingFinancial(false);
    }
  };

  /* ── Save notifications ── */
  const handleSaveNotif = async () => {
    setSavingNotif(true);
    try {
      await settingsAPI.update({
        notify_payment: notifyPayment ? "1" : "0",
        notify_maintenance: notifyMaintenance ? "1" : "0",
        notify_overdue: notifyOverdue ? "1" : "0",
      });
      toast.success(
        language === "th"
          ? "บันทึกการแจ้งเตือนแล้ว"
          : "Notification settings saved",
      );
    } catch {
      toast.error(language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred");
    } finally {
      setSavingNotif(false);
    }
  };

  /* ── Save utility rates ── */
  const handleSaveRates = async () => {
    if (!electricRate || !waterRate) {
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
          water_flat_rate: waterFlatRate,
        }),
      ];
      // ถ้าคิดตามหน่วย ให้บันทึก water rate ด้วย
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
      toast.success(
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

  /* ── Telegram generate link ── */
  const handleGenerateLink = async () => {
    setTgLinkLoading(true);
    try {
      const res = await telegramAPI.generateLink();
      const link = res.data?.data?.deepLink;
      setTgDeepLink(link);
      setTgPolling(true);
      let attempts = 0;
      pollingRef.current = setInterval(async () => {
        attempts++;
        try {
          const r = await telegramAPI.getStatus();
          if (r.data?.data?.linked) {
            setTgLinked(true);
            setTgChatId(r.data?.data?.chat_id);
            setTgDeepLink(null);
            setTgPolling(false);
            clearInterval(pollingRef.current!);
            toast.success(
              language === "th"
                ? "เชื่อมต่อ Telegram สำเร็จ! 🎉"
                : "Telegram connected! 🎉",
            );
          }
        } catch {}
        if (attempts >= 200) {
          clearInterval(pollingRef.current!);
          setTgPolling(false);
        }
      }, 3000);
    } catch {
      toast.error(language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred");
    } finally {
      setTgLinkLoading(false);
    }
  };

  const handleUnlink = async () => {
    setTgUnlinkLoading(true);
    try {
      await telegramAPI.unlink();
      setTgLinked(false);
      setTgChatId(null);
      setTgDeepLink(null);
      if (pollingRef.current) clearInterval(pollingRef.current);
      toast.success(
        language === "th" ? "ยกเลิกการเชื่อมต่อแล้ว" : "Disconnected",
      );
    } catch {
      toast.error(language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred");
    } finally {
      setTgUnlinkLoading(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcasting(true);
    try {
      const res = await telegramAPI.broadcast(broadcastMsg);
      const count = res.data?.data?.sent ?? 0;
      toast.success(
        language === "th" ? `ส่งแล้ว ${count} คน` : `Sent to ${count} tenants`,
      );
      setBroadcastMsg("");
    } catch {
      toast.error(language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred");
    } finally {
      setBroadcasting(false);
    }
  };

  const copyBotLink = () => {
    navigator.clipboard.writeText(`https://t.me/${botUsername}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
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
              <SelectItem value="notifications">
                🔔 {t("settings.tabNotifications")}
              </SelectItem>
              <SelectItem value="telegram">✈️ Telegram</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop: Tabs */}
        <TabsList className="hidden sm:grid w-full grid-cols-5">
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
          <TabsTrigger value="notifications">
            <Bell className="h-3.5 w-3.5 mr-1.5" />
            {t("settings.tabNotifications")}
          </TabsTrigger>
          <TabsTrigger value="telegram">Telegram</TabsTrigger>
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
        <TabsContent value="financial">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.financialTitle")}</CardTitle>
              <CardDescription>{t("settings.financialDesc")}</CardDescription>
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
                  placeholder="xxx-x-xxxxx-x"
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
                {language === "th" ? "บันทึก" : "Save"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Utilities ── */}
        <TabsContent value="utilities" className="space-y-4">
          {/* Current rates */}
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
                  ฿{currentRates.water?.rate_per_unit ?? "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === "th" ? "ต่อหน่วย" : "per unit"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Set new rates */}
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
                  {/* Toggle unit / flat */}
                  <div className="flex rounded-md border border-border overflow-hidden text-xs font-medium w-fit">
                    <button
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
                  <Input
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    type="date"
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

        {/* ── Notifications ── */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.tabNotifications")}</CardTitle>
              <CardDescription>
                {language === "th"
                  ? "เลือกประเภทการแจ้งเตือนที่ต้องการ"
                  : "Choose notification types"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                {
                  label:
                    language === "th"
                      ? "แจ้งเตือนเมื่อผู้เช่าชำระเงิน"
                      : "Notify on tenant payment",
                  value: notifyPayment,
                  set: setNotifyPayment,
                },
                {
                  label:
                    language === "th"
                      ? "แจ้งเตือนเมื่อมีคำขอแจ้งซ่อม"
                      : "Notify on maintenance request",
                  value: notifyMaintenance,
                  set: setNotifyMaintenance,
                },
                {
                  label:
                    language === "th"
                      ? "แจ้งเตือนเมื่อบิลเกินกำหนด"
                      : "Notify on overdue bills",
                  value: notifyOverdue,
                  set: setNotifyOverdue,
                },
              ].map(({ label, value, set }) => (
                <div key={label} className="flex items-center justify-between">
                  <label className="text-sm font-medium">{label}</label>
                  <Switch checked={value} onCheckedChange={set} />
                </div>
              ))}
              <Button onClick={handleSaveNotif} disabled={savingNotif}>
                {savingNotif ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {language === "th" ? "บันทึก" : "Save"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Telegram ── */}
        <TabsContent value="telegram" className="space-y-4">
          {/* Link admin account */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {language === "th"
                  ? "เชื่อมบัญชี Telegram ของ Admin"
                  : "Link Admin Telegram Account"}
              </CardTitle>
              <CardDescription>
                {language === "th"
                  ? "รับแจ้งเตือนการชำระเงินและคำขอแจ้งซ่อม"
                  : "Receive payment and maintenance notifications"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tgLinked ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-green-600 dark:text-green-400">
                        {language === "th" ? "เชื่อมต่อแล้ว" : "Connected"}
                      </p>
                      {tgChatId && (
                        <p className="text-xs text-muted-foreground">
                          Chat ID: {tgChatId}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnlink}
                    disabled={tgUnlinkLoading}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    {tgUnlinkLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {language === "th"
                          ? "กำลังยกเลิก..."
                          : "Disconnecting..."}
                      </>
                    ) : (
                      <>
                        <Unlink className="mr-2 h-4 w-4" />
                        {language === "th"
                          ? "ยกเลิกการเชื่อมต่อ"
                          : "Disconnect"}
                      </>
                    )}
                  </Button>
                </div>
              ) : tgDeepLink ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-2">
                    <p className="text-sm font-medium">
                      {language === "th" ? "วิธีเชื่อมต่อ:" : "How to connect:"}
                    </p>
                    <ol className="text-sm text-muted-foreground space-y-1 list-none">
                      {(language === "th"
                        ? [
                            "กดปุ่ม 'เปิด Telegram' ด้านล่าง",
                            "กด Start ใน Telegram",
                            "กลับมาหน้านี้ — จะเชื่อมต่ออัตโนมัติ",
                          ]
                        : [
                            "Tap 'Open Telegram' below",
                            "Tap Start in Telegram",
                            "Return here — will connect automatically",
                          ]
                      ).map((step, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="bg-primary/20 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      asChild
                      className="flex-1 bg-[#2AABEE] hover:bg-[#2AABEE]/90"
                    >
                      <a
                        href={tgDeepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {language === "th" ? "เปิด Telegram" : "Open Telegram"}
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleGenerateLink}
                      disabled={tgLinkLoading}
                      title={language === "th" ? "สร้างลิงก์ใหม่" : "New link"}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  {tgPolling && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {language === "th"
                        ? "รอการเชื่อมต่อ... (ลิงก์หมดอายุใน 10 นาที)"
                        : "Waiting for connection... (expires in 10 min)"}
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  onClick={handleGenerateLink}
                  disabled={tgLinkLoading}
                  className="bg-[#2AABEE] hover:bg-[#2AABEE]/90"
                >
                  {tgLinkLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {language === "th"
                        ? "กำลังสร้างลิงก์..."
                        : "Creating link..."}
                    </>
                  ) : (
                    <>
                      <LinkIcon className="mr-2 h-4 w-4" />
                      {language === "th"
                        ? "เชื่อมต่อ Telegram"
                        : "Connect Telegram"}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Bot info */}
          {botUsername && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {language === "th" ? "ข้อมูล Bot" : "Bot Info"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Bot:</span>
                <span className="font-mono bg-muted px-2 py-0.5 rounded text-sm">
                  @{botUsername}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={copyBotLink}
                >
                  {isCopied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Broadcast */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="h-4 w-4" />
                {language === "th"
                  ? "ส่งข้อความถึงผู้เช่าทุกคน"
                  : "Broadcast to All Tenants"}
              </CardTitle>
              <CardDescription>
                {language === "th"
                  ? "ส่งข้อความผ่าน Telegram ไปยังผู้เช่าทุกคนที่เชื่อมต่อแล้ว"
                  : "Send Telegram message to all connected tenants"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder={
                  language === "th"
                    ? "พิมพ์ข้อความที่จะส่ง..."
                    : "Type your message..."
                }
                rows={4}
              />
              <Button
                onClick={handleBroadcast}
                disabled={broadcasting || !broadcastMsg.trim()}
              >
                {broadcasting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {language === "th" ? "ส่งข้อความ" : "Send Message"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
