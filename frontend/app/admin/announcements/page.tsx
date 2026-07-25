//frontend/app/admin/announcements/page.tsx

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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Megaphone,
  Pencil,
  Trash2,
  AlertCircle,
  Info,
  Bell,
  Loader2,
  Send,
} from "lucide-react";
import { announcementAPI } from "@/lib/api/announcement.api";
import { toast } from "sonner";
import { useLanguage } from "@/context/language-context";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Announcement {
  announcement_id: number;
  title: string;
  content: string;
  target_audience: "all" | "admin" | "tenant";
  target_floor: number | null;
  is_pinned: number;
  published_by: number;
  published_at: string;
  expires_at: string | null;
}

interface FormData {
  title: string;
  content: string;
  target_audience: "all" | "admin" | "tenant";
  target_floor: string;
  is_pinned: boolean;
  expires_at: string;
}

const emptyForm: FormData = {
  title: "",
  content: "",
  target_audience: "all",
  target_floor: "",
  is_pinned: false,
  expires_at: "",
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// ── Component ──────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const { t } = useLanguage();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await announcementAPI.getAll();
      setAnnouncements(res.data ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        title: formData.title,
        content: formData.content,
        target_audience: formData.target_audience,
        is_pinned: formData.is_pinned ? 1 : 0,
      };
      if (formData.target_floor)
        payload.target_floor = parseInt(formData.target_floor);
      if (formData.expires_at) payload.expires_at = formData.expires_at;

      if (editingAnn) {
        await announcementAPI.update(editingAnn.announcement_id, payload);
        toast.success(t("announcements.updated"));
      } else {
        await announcementAPI.create(payload);
        toast.success(t("announcements.created"));
      }

      resetForm();
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const handleEdit = (ann: Announcement) => {
    setEditingAnn(ann);
    setFormData({
      title: ann.title,
      content: ann.content,
      target_audience: ann.target_audience,
      target_floor: ann.target_floor ? String(ann.target_floor) : "",
      is_pinned: ann.is_pinned === 1,
      expires_at: ann.expires_at ? ann.expires_at.split("T")[0] : "",
    });
    setIsAddDialogOpen(true);
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (ann: Announcement) => {
    if (!confirm(`${t("announcements.confirmDelete")} "${ann.title}" ?`))
      return;

    try {
      await announcementAPI.delete(ann.announcement_id);
      toast.success(t("announcements.deleted"));
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Error");
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingAnn(null);
    setIsAddDialogOpen(false);
  };

  const set =
    (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData((p) => ({ ...p, [field]: e.target.value }));

  const getAudienceLabel = (key: string) => {
    if (key === "all") return t("announcements.everyone");
    if (key === "admin") return t("announcements.adminOnly");
    if (key === "tenant") return t("announcements.tenantOnly");
    return key;
  };

  const getPriorityIcon = (ann: Announcement) => {
    if (ann.is_pinned) return <Bell className="h-5 w-5 text-yellow-500" />;
    if (ann.target_audience === "admin")
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    return <Info className="h-5 w-5 text-primary" />;
  };

  const isExpired = (ann: Announcement) =>
    ann.expires_at ? new Date(ann.expires_at) < new Date() : false;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("announcements.title")}</h1>
          <p className="text-muted-foreground">{t("announcements.subtitle")}</p>
        </div>

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
              {t("announcements.create")}
            </Button>
          </DialogTrigger>

          {/*
            Fix kept from before: the dialog is a flex column capped at 85vh
            with a scrollable body and an always-visible footer. This is what
            actually caused "พิมพ์เสร็จแล้วกดต่อไม่ได้" — nothing to do with
            room targeting, just a layout bug in the original modal.
          */}
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>
                {editingAnn
                  ? t("announcements.edit")
                  : t("announcements.createNew")}
              </DialogTitle>
              <DialogDescription>
                {editingAnn
                  ? t("announcements.edit")
                  : t("announcements.create")}
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 min-h-0"
            >
              <ScrollArea className="flex-1 px-6">
                <FieldGroup className="pb-4">
                  <Field>
                    <FieldLabel htmlFor="title">
                      {t("announcements.titleField")}
                    </FieldLabel>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={set("title")}
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="content">
                      {t("announcements.content")}
                    </FieldLabel>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={set("content")}
                      rows={5}
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel>{t("announcements.audience")}</FieldLabel>
                    <Select
                      value={formData.target_audience}
                      onValueChange={(v) =>
                        setFormData((p) => ({
                          ...p,
                          target_audience: v as FormData["target_audience"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("announcements.everyone")}
                        </SelectItem>
                        <SelectItem value="tenant">
                          {t("announcements.tenantOnly")}
                        </SelectItem>
                        <SelectItem value="admin">
                          {t("announcements.adminOnly")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  {/* Per spec: send to a specific floor. Only meaningful
                      when targeting tenants (not admin-only announcements). */}
                  {formData.target_audience !== "admin" && (
                    <Field>
                      <FieldLabel htmlFor="target_floor">
                        {t("announcements.floor")}
                      </FieldLabel>
                      <Input
                        id="target_floor"
                        type="number"
                        min={1}
                        placeholder={t("announcements.floorPlaceholder")}
                        value={formData.target_floor}
                        onChange={set("target_floor")}
                      />
                    </Field>
                  )}
                </FieldGroup>
              </ScrollArea>

              {/* Footer is sticky at the bottom of the dialog, always visible
                  regardless of how tall the form body scrolls. */}
              <DialogFooter className="p-6 pt-4 border-t shrink-0">
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {editingAnn
                    ? t("common.save")
                    : t("announcements.sendViaTelegram")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("common.loading")}
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t("announcements.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        announcements.map((ann) => (
          <Card key={ann.announcement_id}>
            <CardHeader>
              <div className="flex justify-between">
                <div className="flex gap-3">
                  {getPriorityIcon(ann)}
                  <div>
                    <CardTitle>{ann.title}</CardTitle>
                    <CardDescription>
                      {getAudienceLabel(ann.target_audience)}
                      {ann.target_floor
                        ? ` · ${t("announcements.floorBadge")} ${ann.target_floor}`
                        : ""}
                    </CardDescription>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(ann)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    {t("common.edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(ann)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>{ann.content}</CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
