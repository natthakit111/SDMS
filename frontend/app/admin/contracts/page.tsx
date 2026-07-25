//contracts/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import {
  FileText,
  Plus,
  Eye,
  XCircle,
  Loader2,
  Search,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { contractAPI } from "@/lib/api/contract.api";
import { tenantAPI } from "@/lib/api/tenant.api";
import { roomAPI } from "@/lib/api/room.api";
import { toast } from "sonner";
import { useLanguage } from "@/context/language-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contract {
  contract_id: number;
  tenant_id: number;
  room_id: number;
  tenant_name: string;
  room_number: string;
  start_date: string;
  end_date: string;
  rent_amount: number;
  deposit_amount: number;
  status: "active" | "expired" | "terminated";
  note: string | null;
}

interface FormData {
  tenant_id: string;
  room_id: string;
  start_date: string;
  end_date: string;
  rent_amount: string;
  deposit_amount: string;
  note: string;
}

interface RenewFormData {
  end_date: string;
  rent_amount: string;
}

interface CheckoutFormData {
  checkout_date: string;
}

const emptyForm: FormData = {
  tenant_id: "",
  room_id: "",
  start_date: "",
  end_date: "",
  rent_amount: "",
  deposit_amount: "",
  note: "",
};

const emptyRenewForm: RenewFormData = {
  end_date: "",
  rent_amount: "",
};

const emptyCheckoutForm: CheckoutFormData = {
  checkout_date: "",
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-500",
  expired: "bg-red-500/10 text-red-500",
  terminated: "bg-muted text-muted-foreground",
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const { t } = useLanguage();
  const formatCurrency = (n: number) =>
    n.toLocaleString("th-TH") + " " + t("contracts.baht");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  // ── Renew contract ──────────────────────────────────────────────────────
  const [renewingContract, setRenewingContract] = useState<Contract | null>(
    null,
  );
  const [renewForm, setRenewForm] = useState<RenewFormData>(emptyRenewForm);
  const [renewSubmitting, setRenewSubmitting] = useState(false);

  // ── Checkout / ทำเรื่องย้ายออก (สำหรับสัญญา expired) ───────────────────────
  const [checkingOutContract, setCheckingOutContract] =
    useState<Contract | null>(null);
  const [checkoutForm, setCheckoutForm] =
    useState<CheckoutFormData>(emptyCheckoutForm);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  // ── Fetch contracts ───────────────────────────────────────────────────────
  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus !== "all") params.status = filterStatus;
      const res = await contractAPI.getAll(params);
      setContracts(res.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("contracts.loadError"));
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  // ── Fetch tenants + available rooms for form ──────────────────────────────
  const fetchFormOptions = async () => {
    try {
      const [tRes, rRes] = await Promise.all([
        tenantAPI.getAll(),
        roomAPI.getAll({ status: "available" }),
      ]);
      setTenants(tRes.data ?? []);
      setAvailableRooms(rRes.data ?? []);
    } catch {
      /* ไม่ critical */
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);
  useEffect(() => {
    fetchFormOptions();
  }, []);

  // ── Filter client-side ────────────────────────────────────────────────────
  const filteredContracts = contracts.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.tenant_name?.toLowerCase().includes(q) ||
      c.room_number?.toLowerCase().includes(q) ||
      String(c.contract_id).includes(q)
    );
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalDeposit = contracts
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + Number(c.deposit_amount), 0);

  // ── Create contract ───────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await contractAPI.create({
        tenant_id: parseInt(formData.tenant_id),
        room_id: parseInt(formData.room_id),
        start_date: formData.start_date,
        end_date: formData.end_date,
        rent_amount: formData.rent_amount
          ? parseFloat(formData.rent_amount)
          : undefined,
        deposit_amount: formData.deposit_amount
          ? parseFloat(formData.deposit_amount)
          : undefined,
        note: formData.note || undefined,
      });
      toast.success(t("contracts.createSuccess"));
      resetForm();
      fetchContracts();
      fetchFormOptions(); // refresh available rooms
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("contracts.createError"));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Terminate contract ────────────────────────────────────────────────────
  const handleTerminate = async (contract: Contract) => {
    if (
      !confirm(
        `${t("contracts.confirmTerminate")} ${contract.tenant_name} ${t("contracts.confirmTerminate2")} ${contract.room_number} ${t("contracts.confirmTerminate3")}`,
      )
    )
      return;
    try {
      const res = await contractAPI.terminate(contract.contract_id);
      toast.success(res.message ?? t("contracts.terminateSuccess"));
      setViewingContract(null);
      fetchContracts();
      fetchFormOptions();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? t("contracts.terminateError"),
      );
    }
  };

  // ── Renew contract ────────────────────────────────────────────────────────
  const openRenewDialog = (contract: Contract) => {
    setRenewForm({
      end_date: "",
      rent_amount: String(contract.rent_amount ?? ""),
    });
    setRenewingContract(contract);
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingContract) return;
    setRenewSubmitting(true);
    try {
      const res = await contractAPI.renew(renewingContract.contract_id, {
        end_date: renewForm.end_date,
        rent_amount: renewForm.rent_amount
          ? parseFloat(renewForm.rent_amount)
          : undefined,
      });
      toast.success(res.message ?? t("contracts.renewSuccess"));
      setRenewingContract(null);
      setRenewForm(emptyRenewForm);
      setViewingContract(null);
      fetchContracts();
      fetchFormOptions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("contracts.renewError"));
    } finally {
      setRenewSubmitting(false);
    }
  };

  // ── Checkout (ทำเรื่องย้ายออก) ────────────────────────────────────────────
  // ใช้ endpoint terminate ตัวเดิม เพราะ backend relax เงื่อนไขให้รองรับสัญญา
  // expired แล้ว (ปลดห้องว่าง + คำนวณคืนเงินมัดจำให้อัตโนมัติ)
  const openCheckoutDialog = (contract: Contract) => {
    setCheckoutForm({
      checkout_date: new Date().toISOString().slice(0, 10),
    });
    setCheckingOutContract(contract);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkingOutContract) return;
    setCheckoutSubmitting(true);
    try {
      const res = await contractAPI.terminate(checkingOutContract.contract_id, {
        checkout_date: checkoutForm.checkout_date,
      });
      toast.success(res.message ?? t("contracts.checkoutSuccess"));
      setCheckingOutContract(null);
      setCheckoutForm(emptyCheckoutForm);
      setViewingContract(null);
      fetchContracts();
      fetchFormOptions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("contracts.checkoutError"));
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setIsAddDialogOpen(false);
  };

  const set =
    (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData((p) => ({ ...p, [field]: e.target.value }));

  const setRenewField =
    (field: keyof RenewFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setRenewForm((p) => ({ ...p, [field]: e.target.value }));

  const setCheckoutField =
    (field: keyof CheckoutFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setCheckoutForm((p) => ({ ...p, [field]: e.target.value }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("contracts.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("contracts.subtitle")}
          </p>
        </div>

        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            if (!open) resetForm();
            setIsAddDialogOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t("contracts.new")}
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("contracts.newTitle")}</DialogTitle>
              <DialogDescription>{t("contracts.newDesc")}</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <FieldGroup>
                {/* ผู้เช่า */}
                <Field>
                  <FieldLabel>{t("contracts.tenant")}</FieldLabel>
                  <Select
                    value={formData.tenant_id}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, tenant_id: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("contracts.selectTenant")} />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem
                          key={t.tenant_id}
                          value={String(t.tenant_id)}
                        >
                          {t.first_name} {t.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* ห้อง */}
                <Field>
                  <FieldLabel>{t("contracts.availableRoom")}</FieldLabel>
                  <Select
                    value={formData.room_id}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, room_id: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("contracts.selectRoom")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRooms.map((r) => (
                        <SelectItem key={r.room_id} value={String(r.room_id)}>
                          {t("contracts.room")} {r.room_number} —{" "}
                          {r.base_rent?.toLocaleString("th-TH")}{" "}
                          {t("contracts.perMonth")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* วันที่ */}
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="start_date">
                      {t("contracts.startDate")}
                    </FieldLabel>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={set("start_date")}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="end_date">
                      {t("contracts.endDate")}
                    </FieldLabel>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={set("end_date")}
                      required
                    />
                  </Field>
                </div>

                {/* ค่าเช่า / เงินประกัน */}
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="rent_amount">
                      {t("contracts.rentAmountBaht")}
                    </FieldLabel>
                    <Input
                      id="rent_amount"
                      type="number"
                      value={formData.rent_amount}
                      onChange={set("rent_amount")}
                      placeholder={t("contracts.useRoomRent")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="deposit_amount">
                      {t("contracts.depositBaht")}
                    </FieldLabel>
                    <Input
                      id="deposit_amount"
                      type="number"
                      value={formData.deposit_amount}
                      onChange={set("deposit_amount")}
                      placeholder="0"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="note">{t("common.note")}</FieldLabel>
                  <Input
                    id="note"
                    value={formData.note}
                    onChange={set("note")}
                    placeholder={t("contracts.noteExtra")}
                  />
                </Field>
              </FieldGroup>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitting || !formData.tenant_id || !formData.room_id
                  }
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("contracts.create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("contracts.statsTotal")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contracts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("contracts.statsActive")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {contracts.filter((c) => c.status === "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("contracts.statsExpiredOrTerminated")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {contracts.filter((c) => c.status !== "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("contracts.statsTotalDeposit")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalDeposit.toLocaleString("th-TH")} {t("contracts.baht")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("contracts.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="active">
                  {t("status.active.label")}
                </SelectItem>
                <SelectItem value="expired">
                  {t("status.expired.label")}
                </SelectItem>
                <SelectItem value="terminated">
                  {t("status.terminated.label")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contracts List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredContracts.map((contract) => {
            const statusColor =
              statusColors[contract.status] ?? statusColors.expired;
            const statusKey = `status.${contract.status}.label` as string;
            return (
              <Card key={contract.contract_id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4 flex-1">
                      <div className="bg-primary/10 p-3 rounded-lg h-fit">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-bold text-lg">
                              {contract.tenant_name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {t("contracts.room")} {contract.room_number} • CNT
                              {String(contract.contract_id).padStart(3, "0")}
                            </p>
                            <div className="flex gap-2 mt-3 flex-wrap">
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {t("contracts.rentLabel")}{" "}
                                {Number(contract.rent_amount).toLocaleString(
                                  "th-TH",
                                )}{" "}
                                {t("contracts.baht")}
                              </span>
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {t("contracts.depositLabel")}{" "}
                                {Number(contract.deposit_amount).toLocaleString(
                                  "th-TH",
                                )}{" "}
                                {t("contracts.baht")}
                              </span>
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {formatDate(contract.start_date)} —{" "}
                                {formatDate(contract.end_date)}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded ${statusColor}`}
                          >
                            {t(statusKey)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => setViewingContract(contract)}
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          {t("common.view")}
                        </span>
                      </Button>
                      {contract.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => handleTerminate(contract)}
                        >
                          <XCircle className="w-4 h-4" />
                          <span className="hidden sm:inline">
                            {t("common.cancel")}
                          </span>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredContracts.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">
                  {t("contracts.notFound")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* View Dialog */}
      <Dialog
        open={!!viewingContract}
        onOpenChange={(open) => !open && setViewingContract(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("contracts.detailTitle")}</DialogTitle>
          </DialogHeader>
          {viewingContract && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">
                    {t("contracts.tenantName")}
                  </p>
                  <p className="font-medium">{viewingContract.tenant_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("contracts.room")}</p>
                  <p className="font-medium">{viewingContract.room_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("contracts.startDate")}
                  </p>
                  <p className="font-medium">
                    {formatDate(viewingContract.start_date)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("contracts.endDate")}
                  </p>
                  <p className="font-medium">
                    {formatDate(viewingContract.end_date)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("contracts.monthlyRent")}
                  </p>
                  <p className="font-medium">
                    {formatCurrency(Number(viewingContract.rent_amount))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("contracts.deposit")}
                  </p>
                  <p className="font-medium">
                    {formatCurrency(Number(viewingContract.deposit_amount))}
                  </p>
                </div>
              </div>
              {viewingContract.note && (
                <div className="text-sm">
                  <p className="text-muted-foreground">{t("common.note")}</p>
                  <p>{viewingContract.note}</p>
                </div>
              )}
              {viewingContract.status === "active" && (
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={() => handleTerminate(viewingContract)}
                >
                  <XCircle className="w-4 h-4" />
                  {t("contracts.terminateAction")}
                </Button>
              )}
              {viewingContract.status === "expired" && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => openRenewDialog(viewingContract)}
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("contracts.renewAction")}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 gap-2"
                    onClick={() => openCheckoutDialog(viewingContract)}
                  >
                    <LogOut className="w-4 h-4" />
                    {t("contracts.moveOutAction")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Renew Dialog */}
      <Dialog
        open={!!renewingContract}
        onOpenChange={(open) => {
          if (!open) {
            setRenewingContract(null);
            setRenewForm(emptyRenewForm);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("contracts.renewTitle")}</DialogTitle>
            <DialogDescription>
              {renewingContract?.tenant_name} • {t("contracts.room")}{" "}
              {renewingContract?.room_number}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRenewSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="renew_end_date">
                  {t("contracts.newEndDate")}
                </FieldLabel>
                <Input
                  id="renew_end_date"
                  type="date"
                  value={renewForm.end_date}
                  onChange={setRenewField("end_date")}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="renew_rent_amount">
                  {t("contracts.rentAmountBaht")}
                </FieldLabel>
                <Input
                  id="renew_rent_amount"
                  type="number"
                  value={renewForm.rent_amount}
                  onChange={setRenewField("rent_amount")}
                  placeholder={t("contracts.useRoomRent")}
                />
              </Field>
            </FieldGroup>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRenewingContract(null);
                  setRenewForm(emptyRenewForm);
                }}
                disabled={renewSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={renewSubmitting || !renewForm.end_date}
              >
                {renewSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("contracts.renewConfirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog (ทำเรื่องย้ายออก / เคลียร์ห้องสำหรับสัญญาหมดอายุ) */}
      <Dialog
        open={!!checkingOutContract}
        onOpenChange={(open) => {
          if (!open) {
            setCheckingOutContract(null);
            setCheckoutForm(emptyCheckoutForm);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("contracts.moveOutTitle")}</DialogTitle>
            <DialogDescription>
              {checkingOutContract?.tenant_name} • {t("contracts.room")}{" "}
              {checkingOutContract?.room_number}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCheckoutSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="checkout_date">
                  {t("contracts.moveOutDate")}
                </FieldLabel>
                <Input
                  id="checkout_date"
                  type="date"
                  value={checkoutForm.checkout_date}
                  onChange={setCheckoutField("checkout_date")}
                  required
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                {t("contracts.checkoutDepositNote")}
              </p>
            </FieldGroup>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCheckingOutContract(null);
                  setCheckoutForm(emptyCheckoutForm);
                }}
                disabled={checkoutSubmitting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={checkoutSubmitting || !checkoutForm.checkout_date}
              >
                {checkoutSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("contracts.moveOutConfirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}