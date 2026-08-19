// admin/maintenance/page.tsx

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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import {
  MaintenanceStatusBadge,
  PriorityBadge,
} from "@/components/common/status-badge";
import { Search, Wrench, Eye, CheckCircle, Loader2 } from "lucide-react";
import { maintenanceAPI } from "@/lib/api/maintenance.api";
import { getMediaUrl } from "@/lib/media-url";
import { toast } from "sonner";
import { useLanguage } from "@/context/language-context";
import { MaintenanceRequest } from "@/types/index";

interface UpdateData {
  status: string;
  assigned_to: string;
  admin_note: string;
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const imgUrl = (path: string | null) => getMediaUrl(path, "detail");

// ── กฎการเรียงลำดับ ──────────────────────────────────────────────────────────
// กลุ่ม "รอดำเนินการ / กำลังดำเนินการ" อยู่บนเสมอ เรียงตามความสำคัญ (ด่วนก่อน)
// ถ้าความสำคัญเท่ากัน เอาที่แจ้งมานานสุดขึ้นก่อน (รอมานานสุด = เร่งด่วนกว่า)
// กลุ่ม "เสร็จสิ้น / ยกเลิก" ตกไปอยู่ล่างสุด เรียงใหม่สุดก่อน
const ACTIVE_STATUSES = ["pending", "in_progress"];
const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

const sortRequests = (list: MaintenanceRequest[]) =>
  [...list].sort((a, b) => {
    const aActive = ACTIVE_STATUSES.includes(a.status);
    const bActive = ACTIVE_STATUSES.includes(b.status);

    if (aActive !== bActive) return aActive ? -1 : 1;

    if (aActive) {
      const priorityDiff =
        (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

// ── Component ──────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewingRequest, setViewingRequest] =
    useState<MaintenanceRequest | null>(null);
  const [updateData, setUpdateData] = useState<UpdateData>({
    status: "",
    assigned_to: "",
    admin_note: "",
  });

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await maintenanceAPI.getAll(params);
      setRequests(res.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("maintenance.loadError"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // ── Filter client-side ────────────────────────────────────────────────────
  const filteredRequests = requests.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.room_number?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q) ||
      r.tenant_name?.toLowerCase().includes(q)
    );
  });

  // ── เรียงลำดับ: งานค้างอยู่บน (ตามความสำคัญ), งานจบแล้วอยู่ล่าง (ใหม่สุดก่อน) ──
  const sortedRequests = sortRequests(filteredRequests);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  // ── Update status ─────────────────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!viewingRequest) return;
    setUpdating(true);
    try {
      await maintenanceAPI.updateStatus(viewingRequest.request_id, {
        status: updateData.status || viewingRequest.status,
        admin_note: updateData.admin_note || undefined,
        assigned_to: updateData.assigned_to || undefined,
      });
      toast.success(t("maintenance.updateSuccess"));
      setViewingRequest(null);
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("maintenance.updateError"));
    } finally {
      setUpdating(false);
    }
  };

  const openViewDialog = (request: MaintenanceRequest) => {
    setViewingRequest(request);
    setUpdateData({
      status: request.status,
      assigned_to: request.assigned_to ?? "",
      admin_note: request.admin_note ?? "",
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("maintenance.title")}</h1>
        <p className="text-muted-foreground">{t("maintenance.subtitle")}</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("maintenance.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t("maintenance.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("maintenance.allStatuses")}
                </SelectItem>
                <SelectItem value="pending">{t("status.pending")}</SelectItem>
                <SelectItem value="in_progress">
                  {t("status.in_progress")}
                </SelectItem>
                <SelectItem value="resolved">{t("status.resolved")}</SelectItem>
                <SelectItem value="cancelled">
                  {t("status.cancelled")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Wrench className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-semibold">{t("status.pending")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("maintenance.pendingAlert").replace(
                    "{n}",
                    String(pendingCount),
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {t("maintenance.list")}
          </CardTitle>
          <CardDescription>
            {t("maintenance.totalItems").replace(
              "{n}",
              String(filteredRequests.length),
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : (
            <>
              {/* ── Desktop: table ───────────────────────────────────── */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("meters.colRoom")}</TableHead>
                    <TableHead>{t("maintenance.colReporter")}</TableHead>
                    <TableHead>{t("maintenance.colCategory")}</TableHead>
                    <TableHead>{t("maintenance.colPriority")}</TableHead>
                    <TableHead>{t("maintenance.colReportedAt")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead className="text-right">
                      {t("common.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRequests.map((request) => (
                    <TableRow key={request.request_id}>
                      <TableCell className="font-medium">
                        {request.room_number}
                      </TableCell>
                      <TableCell>{request.tenant_name}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.category}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {request.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={request.priority} />
                      </TableCell>
                      <TableCell>{formatDate(request.created_at)}</TableCell>
                      <TableCell>
                        <MaintenanceStatusBadge status={request.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openViewDialog(request)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedRequests.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {t("maintenance.notFound")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* ── Mobile: card list ──────────────────────────────────
                  เดิม table เดียวใช้ทุกขนาดจอ 7 คอลัมน์ล้นจอมือถือ ต้อง
                  scroll ซ้าย-ขวา — ตอนนี้แยกเป็นการ์ดที่กดได้ทั้งใบ พร้อม
                  โชว์ priority/status badge เด่นๆ ให้สแกนงานด่วนได้ไว */}
              <div className="md:hidden space-y-3">
                {sortedRequests.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("maintenance.notFound")}
                  </div>
                )}
                {sortedRequests.map((request) => (
                  <button
                    key={request.request_id}
                    type="button"
                    onClick={() => openViewDialog(request)}
                    className="w-full text-left rounded-lg border p-3 space-y-1.5 active:bg-muted/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <p className="font-medium text-sm">
                          {request.room_number}
                        </p>
                        <span className="text-xs text-muted-foreground truncate">
                          · {request.tenant_name}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDate(request.created_at)}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {request.category}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {request.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <PriorityBadge priority={request.priority} />
                        <MaintenanceStatusBadge status={request.status} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* View/Update Dialog */}
      <Dialog
        open={!!viewingRequest}
        onOpenChange={(open) => {
          if (!open) setViewingRequest(null);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("maintenance.detailTitle")}</DialogTitle>
            <DialogDescription>{t("maintenance.detailDesc")}</DialogDescription>
          </DialogHeader>

          {viewingRequest && (
            <div className="space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("meters.colRoom")}</p>
                  <p className="font-medium">{viewingRequest.room_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("maintenance.colReporter")}
                  </p>
                  <p className="font-medium">{viewingRequest.tenant_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("maintenance.colCategory")}
                  </p>
                  <p className="font-medium">{viewingRequest.category}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("maintenance.colPriority")}
                  </p>
                  <PriorityBadge priority={viewingRequest.priority} />
                </div>
              </div>

              <div className="text-sm">
                <p className="text-muted-foreground mb-1">
                  {t("maintenance.description")}
                </p>
                <p className="bg-muted/50 p-3 rounded-lg">
                  {viewingRequest.description}
                </p>
              </div>

              {imgUrl(viewingRequest.image_path) && (
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">
                    {t("maintenance.image")}
                  </p>
                  <img
                    src={imgUrl(viewingRequest.image_path) ?? ""}
                    alt={viewingRequest.category}
                    className="w-full rounded-lg object-contain max-h-48 bg-muted"
                  />
                </div>
              )}

              {/* Update form */}
              <div className="pt-4 border-t space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel>{t("common.status")}</FieldLabel>
                    <Select
                      value={updateData.status}
                      onValueChange={(v) =>
                        setUpdateData((p) => ({ ...p, status: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">
                          {t("status.pending")}
                        </SelectItem>
                        <SelectItem value="in_progress">
                          {t("status.in_progress")}
                        </SelectItem>
                        <SelectItem value="resolved">
                          {t("status.resolved")}
                        </SelectItem>
                        <SelectItem value="cancelled">
                          {t("status.cancelled")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>{t("maintenance.assignedTo")}</FieldLabel>
                    <Input
                      value={updateData.assigned_to}
                      onChange={(e) =>
                        setUpdateData((p) => ({
                          ...p,
                          assigned_to: e.target.value,
                        }))
                      }
                      placeholder={t("maintenance.assignedPlaceholder")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("common.note")}</FieldLabel>
                    <Textarea
                      value={updateData.admin_note}
                      onChange={(e) =>
                        setUpdateData((p) => ({
                          ...p,
                          admin_note: e.target.value,
                        }))
                      }
                      placeholder={t("maintenance.notePlaceholder")}
                      rows={3}
                    />
                  </Field>
                </FieldGroup>
              </div>

              <DialogFooter className="sticky bottom-0 bg-background pt-4 pb-2 -mx-6 px-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => setViewingRequest(null)}
                  disabled={updating}
                >
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleUpdate} disabled={updating}>
                  {updating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
