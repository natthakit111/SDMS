// admin/tenants/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/language-context"; // <-- เพิ่มบรรทัดนี้
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { TenantStatusBadge } from "@/components/common/status-badge";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  Phone,
  Mail,
  Loader2,
} from "lucide-react";
import { formatDate } from "@/lib/mock-data";
import { tenantAPI } from "@/lib/api/tenant.api";
import { toast } from "sonner";

// ... (ส่วน Types และ emptyForm คงเดิม) ...
interface Tenant {
  tenant_id: number;
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  id_card_number: string;
  phone: string;
  email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  room_number: string | null;
  room_id: number | null;
  contract_status: string | null;
  is_active: boolean;
  created_at: string;
}

interface FormData {
  first_name: string;
  last_name: string;
  username: string;
  password: string;
  email: string;
  phone: string;
  id_card_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

const emptyForm: FormData = {
  first_name: "",
  last_name: "",
  username: "",
  password: "",
  email: "",
  phone: "",
  id_card_number: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
};

export default function TenantsPage() {
  const { t } = useLanguage(); // <-- เรียกใช้ useLanguage

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [showInactive, setShowInactive] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await tenantAPI.getAll({
        search: searchQuery || undefined,
        inactive: showInactive ? "true" : undefined,
      });
      setTenants(res.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, showInactive, t]);

  useEffect(() => {
    const timer = setTimeout(fetchTenants, 300);
    return () => clearTimeout(timer);
  }, [fetchTenants]);

  const filteredTenants = tenants.filter((t) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return t.contract_status === "active";
    if (statusFilter === "no_contract") return !t.contract_status;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingTenant) {
        await tenantAPI.update(editingTenant.tenant_id, {
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          email: formData.email,
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
        });
        toast.success(t("common.saveSuccess"));
      } else {
        await tenantAPI.create({
          first_name: formData.first_name,
          last_name: formData.last_name,
          username: formData.username,
          password: formData.password,
          id_card_number: formData.id_card_number,
          phone: formData.phone,
          email: formData.email || undefined,
          emergency_contact_name: formData.emergency_contact_name || undefined,
          emergency_contact_phone:
            formData.emergency_contact_phone || undefined,
        });
        toast.success(t("common.saveSuccess"));
      }
      resetForm();
      fetchTenants();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      first_name: tenant.first_name,
      last_name: tenant.last_name,
      username: tenant.username,
      password: "",
      email: tenant.email ?? "",
      phone: tenant.phone,
      id_card_number: tenant.id_card_number,
      emergency_contact_name: tenant.emergency_contact_name ?? "",
      emergency_contact_phone: tenant.emergency_contact_phone ?? "",
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (tenant: Tenant) => {
    if (tenant.contract_status === "active") {
      toast.error(t("tenants.cannotDeleteActive"));
      return;
    }
    if (!confirm(t("common.confirmDelete"))) return;
    try {
      await tenantAPI.delete(tenant.tenant_id);
      toast.success(t("common.deleteSuccess"));
      fetchTenants();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("common.error"));
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingTenant(null);
    setIsAddDialogOpen(false);
  };

  const set =
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("tenants.title")}</h1>
          <p className="text-muted-foreground">{t("tenants.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showInactive ? "default" : "outline"}
            onClick={() => {
              setShowInactive(!showInactive);
              setStatusFilter("all");
            }}
          >
            {showInactive ? t("tenants.viewCurrent") : t("tenants.viewHistory")}
          </Button>

          {!showInactive && (
            <Dialog
              open={isAddDialogOpen}
              onOpenChange={(open) => {
                if (!open) resetForm();
                setIsAddDialogOpen(open);
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("tenants.add")}
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingTenant ? t("tenants.edit") : t("tenants.addNew")}
                  </DialogTitle>
                  <DialogDescription>
                    {editingTenant
                      ? t("tenants.editDesc")
                      : t("tenants.addDesc")}
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                  <FieldGroup>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="first_name">
                          {t("common.firstName")}
                        </FieldLabel>
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={set("first_name")}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="last_name">
                          {t("common.lastName")}
                        </FieldLabel>
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={set("last_name")}
                          required
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="email">
                          {t("common.email")}
                        </FieldLabel>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={set("email")}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="phone">
                          {t("common.phone")}
                        </FieldLabel>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={set("phone")}
                          required
                        />
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel htmlFor="id_card_number">
                        {t("tenants.idCard")}
                      </FieldLabel>
                      <Input
                        id="id_card_number"
                        value={formData.id_card_number}
                        onChange={set("id_card_number")}
                        required
                        disabled={!!editingTenant}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="emergency_contact_name">
                          {t("tenants.emergencyName")}
                        </FieldLabel>
                        <Input
                          id="emergency_contact_name"
                          value={formData.emergency_contact_name}
                          onChange={set("emergency_contact_name")}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="emergency_contact_phone">
                          {t("tenants.emergencyPhone")}
                        </FieldLabel>
                        <Input
                          id="emergency_contact_phone"
                          value={formData.emergency_contact_phone}
                          onChange={set("emergency_contact_phone")}
                        />
                      </Field>
                    </div>

                    {!editingTenant && (
                      <div className="grid grid-cols-2 gap-4">
                        <Field>
                          <FieldLabel htmlFor="username">
                            {t("common.username")}
                          </FieldLabel>
                          <Input
                            id="username"
                            value={formData.username}
                            onChange={set("username")}
                            required
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="password">
                            {t("common.password")}
                          </FieldLabel>
                          <Input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={set("password")}
                            required
                          />
                        </Field>
                      </div>
                    )}
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
                    <Button type="submit" disabled={submitting}>
                      {submitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingTenant ? t("common.save") : t("tenants.add")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("tenants.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t("common.allStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allStatus")}</SelectItem>
                <SelectItem value="active">
                  {t("tenants.hasContract")}
                </SelectItem>
                <SelectItem value="no_contract">
                  {t("tenants.noContract")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("tenants.list")}
          </CardTitle>
          <CardDescription>
            {t("common.total")} {filteredTenants.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("common.contact")}</TableHead>
                  <TableHead>{t("rooms.roomNumber")}</TableHead>
                  <TableHead>{t("tenants.contractStatus")}</TableHead>
                  <TableHead>{t("common.createdAt")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => (
                  <TableRow key={tenant.tenant_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {tenant.first_name} {tenant.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tenant.id_card_number}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {tenant.phone}
                        </div>
                        {tenant.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {tenant.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {tenant.room_number ? (
                        <span className="font-medium">
                          {tenant.room_number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {showInactive ? (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                          {t("tenants.deleted")}
                        </span>
                      ) : (
                        <TenantStatusBadge
                          status={
                            tenant.contract_status === "active"
                              ? "active"
                              : "pending"
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell>{formatDate(tenant.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {!showInactive && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(tenant)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(tenant)}
                            disabled={tenant.contract_status === "active"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTenants.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {t("common.noData")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
