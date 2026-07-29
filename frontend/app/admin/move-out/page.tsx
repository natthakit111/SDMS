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
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import {
  LogOut,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Loader2,
  Search,
} from "lucide-react";
import { moveOutAPI } from "@/lib/api/moveOut.api";
import { toast } from "sonner";
import { useLanguage } from "@/context/language-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MoveOutRequest {
  request_id: number;
  tenant_id: number;
  first_name: string;
  last_name: string;
  room_number: string;
  move_out_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  deposit_amount?: number;
}

const fmtDate = (d: string, lang: string) =>
  new Date(d).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const statusConfig = {
  pending: {
    labelKey: "moveout.statusPending",
    icon: Clock,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  approved: {
    labelKey: "moveout.statusApproved",
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  rejected: {
    labelKey: "moveout.statusRejected",
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminMoveOutPage() {
  const { t, language } = useLanguage();
  const [requests, setRequests] = useState<MoveOutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingRequest, setViewingRequest] = useState<MoveOutRequest | null>(
    null,
  );
  const [adminNote, setAdminNote] = useState("");
  const [processing, setProcessing] = useState(false);

  // ── Fetch Move-out Requests ───────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await moveOutAPI.getAll();
      setRequests(res.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("moveout.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = requests.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
      r.room_number?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!viewingRequest) return;
    if (
      !confirm(
        `${t("moveout.confirmApprove")} ${viewingRequest.first_name} ${viewingRequest.last_name}?\n${t("moveout.confirmApproveDetail")}`,
      )
    )
      return;
    setProcessing(true);
    try {
      await moveOutAPI.approve(viewingRequest.request_id, adminNote);
      toast.success(t("moveout.approveSuccess"));
      setViewingRequest(null);
      setAdminNote("");
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("moveout.approveError"));
    } finally {
      setProcessing(false);
    }
  };

  // ── Reject ────────────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!viewingRequest) return;
    if (!adminNote.trim()) {
      toast.error(t("moveout.rejectNoteRequired"));
      return;
    }
    setProcessing(true);
    try {
      await moveOutAPI.reject(viewingRequest.request_id, adminNote);
      toast.success(t("moveout.rejectSuccess"));
      setViewingRequest(null);
      setAdminNote("");
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("moveout.rejectError"));
    } finally {
      setProcessing(false);
    }
  };

  const openDialog = (r: MoveOutRequest) => {
    setViewingRequest(r);
    setAdminNote(r.admin_note ?? "");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LogOut className="h-6 w-6" />
          {t("moveout.title")}
        </h1>
        <p className="text-muted-foreground">{t("moveout.subtitle")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            labelKey: "moveout.statusPending",
            value: requests.filter((r) => r.status === "pending").length,
            color: "text-yellow-500",
          },
          {
            labelKey: "moveout.statusApproved",
            value: requests.filter((r) => r.status === "approved").length,
            color: "text-green-500",
          },
          {
            labelKey: "moveout.statusRejected",
            value: requests.filter((r) => r.status === "rejected").length,
            color: "text-destructive",
          },
        ].map(({ labelKey, value, color }) => (
          <Card key={labelKey}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(labelKey)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("moveout.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t("moveout.allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("moveout.allStatuses")}</SelectItem>
                <SelectItem value="pending">
                  {t("moveout.statusPending")}
                </SelectItem>
                <SelectItem value="approved">
                  {t("moveout.statusApproved")}
                </SelectItem>
                <SelectItem value="rejected">
                  {t("moveout.statusRejected")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("moveout.listTitle")}</CardTitle>
          <CardDescription>
            {t("moveout.totalItems").replace("{n}", String(filtered.length))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.tenant")}</TableHead>
                  <TableHead>{t("contracts.room")}</TableHead>
                  <TableHead>{t("moveout.colMoveOutDate")}</TableHead>
                  <TableHead>{t("moveout.colSubmittedAt")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const s = statusConfig[r.status];
                  const Icon = s.icon;
                  return (
                    <TableRow key={r.request_id}>
                      <TableCell className="font-medium">
                        {r.first_name} {r.last_name}
                      </TableCell>
                      <TableCell>{r.room_number}</TableCell>
                      <TableCell>
                        {fmtDate(r.move_out_date, language)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {fmtDate(r.created_at, language)}
                      </TableCell>
                      <TableCell>
                        <div
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${s.bg} ${s.color}`}
                        >
                          <Icon className="h-3 w-3" />
                          {t(s.labelKey)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDialog(r)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {t("moveout.notFound")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail / Approve / Reject Dialog */}
      <Dialog
        open={!!viewingRequest}
        onOpenChange={(open) => {
          if (!open) {
            setViewingRequest(null);
            setAdminNote("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("moveout.detailTitle")}</DialogTitle>
            <DialogDescription>{t("moveout.detailDesc")}</DialogDescription>
          </DialogHeader>

          {viewingRequest && (
            <div className="space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("common.tenant")}</p>
                  <p className="font-medium">
                    {viewingRequest.first_name} {viewingRequest.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("contracts.room")}</p>
                  <p className="font-medium">{viewingRequest.room_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("moveout.colSubmittedAt")}
                  </p>
                  <p className="font-medium">
                    {fmtDate(viewingRequest.created_at, language)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t("moveout.colMoveOutDate")}
                  </p>
                  <p className="font-medium text-primary">
                    {fmtDate(viewingRequest.move_out_date, language)}
                  </p>
                </div>
              </div>

              <div className="text-sm">
                <p className="text-muted-foreground mb-1">
                  {t("moveout.reason")}
                </p>
                <p className="bg-muted/50 p-3 rounded-lg">
                  {viewingRequest.reason}
                </p>
              </div>

              {/* Admin note */}
              {viewingRequest.status === "pending" ? (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="adminNote">
                      {t("moveout.adminNoteLabel")}
                    </FieldLabel>
                    <Textarea
                      id="adminNote"
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder={t("moveout.adminNotePlaceholder")}
                      rows={3}
                    />
                  </Field>
                </FieldGroup>
              ) : (
                viewingRequest.admin_note && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">
                      {t("moveout.adminNoteTitle")}
                    </p>
                    <p className="bg-muted/50 p-3 rounded-lg">
                      {viewingRequest.admin_note}
                    </p>
                  </div>
                )
              )}

              {/* Actions */}
              {viewingRequest.status === "pending" && (
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setViewingRequest(null);
                      setAdminNote("");
                    }}
                    disabled={processing}
                  >
                    {t("common.close")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={processing}
                  >
                    {processing && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <XCircle className="mr-2 h-4 w-4" />
                    {t("moveout.reject")}
                  </Button>
                  <Button onClick={handleApprove} disabled={processing}>
                    {processing && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {t("moveout.approve")}
                  </Button>
                </DialogFooter>
              )}

              {viewingRequest.status !== "pending" && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setViewingRequest(null)}
                  >
                    {t("common.close")}
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
