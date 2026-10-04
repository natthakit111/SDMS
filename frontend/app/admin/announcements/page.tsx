//app/admin/announcements/page.tsx

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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Megaphone,
  Pencil,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  Pin,
  Users,
  Building2,
  CalendarClock,
  Loader2,
  Send,
} from "lucide-react";
import { announcementAPI } from "@/lib/api/announcement.api";
import { toast } from "sonner";
import { useLanguage } from "@/context/language-context";
import { DatePickerField } from "@/components/common/date-picker-field";
import { useConfirmDialog } from "@/components/common/confirm-dialog";
import { formatDate } from "@/lib/utils";
import { Announcement } from "@/types/index";

// ── Types ─────────────────────────────────────────────────────────────────────

// interface Announcement {
//   announcement_id: number;
//   title: string;
//   content: string;
//   target_audience: "all" | "admin" | "tenant";
//   target_floor: number | null;
//   is_pinned: number;
//   is_urgent: number;
//   published_by: number;
//   published_at: string;
//   expires_at: string | null;
// }

interface FormData {
  title: string;
  content: string;
  target_audience: "all" | "admin" | "tenant";
  target_floor: string;
  is_pinned: boolean;
  is_urgent: boolean;
  expires_at: string;
}

const emptyForm: FormData = {
  title: "",
  content: "",
  target_audience: "all",
  target_floor: "",
  is_pinned: false,
  is_urgent: false,
  expires_at: "",
};

// ── Telegram preview helpers ──────────────────────────────────────────────────
// รับ t function เข้ามาเพื่อใช้ดึงข้อมูลภาษาสำหรับ Preview
const buildPreviewText = (form: FormData, t: any) => {
  const urgentTag = form.is_urgent ? "🚨 " : "";
  const floorLabel = form.target_floor
    ? ` (${t("announcements.floorBadge")} ${form.target_floor})`
    : "";
  return {
    header: `📢 ${urgentTag}${t("announcements.fromDorm")}${floorLabel}`,
    title: form.title || t("announcements.previewTitlePlaceholder"),
    content: form.content || t("announcements.previewContentPlaceholder"),
  };
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const { t, language } = useLanguage();
  const { confirm, ConfirmDialog } = useConfirmDialog();

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
        is_urgent: formData.is_urgent ? 1 : 0,
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
      is_urgent: ann.is_urgent === 1,
      expires_at: ann.expires_at ? ann.expires_at.split("T")[0] : "",
    });
    setIsAddDialogOpen(true);
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (ann: Announcement) => {
    if (!(await confirm(`${t("announcements.confirmDelete")} "${ann.title}" ?`)))
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
    if (ann.is_urgent)
      return <AlertTriangle className="h-5 w-5 text-destructive" />;
    if (ann.is_pinned) return <Pin className="h-5 w-5 text-accent" />;
    if (ann.target_audience === "admin")
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    return <Info className="h-5 w-5 text-primary" />;
  };

  const isExpired = (ann: Announcement) =>
    ann.expires_at ? new Date(ann.expires_at) < new Date() : false;

  const preview = buildPreviewText(formData, t);

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

          <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto p-0 gap-0">
            <DialogHeader className="p-6 pb-4 border-b sticky top-0 bg-background z-10">
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
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

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-6">
                <Tabs defaultValue="form">
                  <TabsList className="w-full grid grid-cols-2 mb-4">
                    <TabsTrigger value="form">
                      {t("announcements.formTab")}
                    </TabsTrigger>
                    <TabsTrigger
                      value="preview"
                      disabled={formData.target_audience === "admin"}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      {t("announcements.telegramPreviewTab")}
                    </TabsTrigger>
                  </TabsList>

                  {/* ═══ แท็บ 1: ฟอร์ม ═══ */}
                  <TabsContent value="form" className="space-y-6 mt-0">
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="title">
                          {t("announcements.titleField")}
                        </FieldLabel>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={set("title")}
                          placeholder={t("announcements.titlePlaceholder")}
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
                          rows={4}
                          placeholder={t("announcements.contentPlaceholder")}
                          required
                        />
                      </Field>
                    </FieldGroup>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {t("announcements.audienceSection")}
                      </div>
                      <FieldGroup>
                        <Field>
                          <FieldLabel>{t("announcements.audience")}</FieldLabel>
                          <Select
                            value={formData.target_audience}
                            onValueChange={(v) =>
                              setFormData((p) => ({
                                ...p,
                                target_audience:
                                  v as FormData["target_audience"],
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent value="tenant">
                              {t("announcements.tenantOnly")}
                            </SelectContent>
                          </Select>
                        </Field>

                        {formData.target_audience !== "admin" && (
                          <Field>
                            <FieldLabel
                              htmlFor="target_floor"
                              className="flex items-center gap-1.5"
                            >
                              <Building2 className="h-3.5 w-3.5" />
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
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Pin className="h-4 w-4" />
                        {t("announcements.prioritySection")}
                      </div>

                      <div className="flex items-center justify-between rounded-md border p-3">
                        <div className="flex items-center gap-2">
                          <Pin className="h-4 w-4 text-accent" />
                          <div>
                            <p className="text-sm font-medium">
                              {t("announcements.pinTitle")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("announcements.pinDesc")}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.is_pinned}
                          onCheckedChange={(v) =>
                            setFormData((p) => ({ ...p, is_pinned: v }))
                          }
                        />
                      </div>

                      {formData.target_audience !== "admin" && (
                        <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                          <Checkbox
                            id="is_urgent"
                            checked={formData.is_urgent}
                            onCheckedChange={(checked) =>
                              setFormData((p) => ({
                                ...p,
                                is_urgent: checked === true,
                              }))
                            }
                          />
                          <div className="grid gap-1 leading-none">
                            <FieldLabel
                              htmlFor="is_urgent"
                              className="flex items-center gap-1.5 text-destructive"
                            >
                              <AlertTriangle className="h-4 w-4" />
                              {t("announcements.urgent")}
                            </FieldLabel>
                            <p className="text-xs text-muted-foreground">
                              {t("announcements.urgentDesc")}
                            </p>
                          </div>
                        </div>
                      )}

                      <Field>
                        <FieldLabel
                          htmlFor="expires_at"
                          className="flex items-center gap-1.5"
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                          {t("announcements.expires")}
                          <span className="text-xs text-muted-foreground font-normal">
                            {t("announcements.optional")}
                          </span>
                        </FieldLabel>
                        {/* เรียกใช้ Component จากไฟล์กลางที่เรา Import มา */}
                        <DatePickerField
                          id="expires_at"
                          value={formData.expires_at}
                          onChange={(v) =>
                            setFormData((p) => ({ ...p, expires_at: v }))
                          }
                          language={language}
                          placeholder={
                            language === "th" ? "เลือกวันที่" : "Select date"
                          }
                        />
                      </Field>
                    </div>
                  </TabsContent>

                  {/* ═══ แท็บ 2: live preview ข้อความ Telegram ═══ */}
                  <TabsContent value="preview" className="space-y-3 mt-0">
                    <p className="text-sm text-muted-foreground">
                      {t("announcements.telegramPreviewDesc")}
                    </p>
                    <div className="rounded-2xl bg-[#17212b] p-4 space-y-2 shadow-sm">
                      <div className="rounded-xl bg-[#2b5278] px-3 py-2.5 text-sm text-white/95 max-w-[92%] space-y-1.5">
                        <p className="font-medium">{preview.header}</p>
                        <p className="font-bold leading-snug">
                          {preview.title}
                        </p>
                        <p className="whitespace-pre-wrap leading-snug text-white/90">
                          {preview.content}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("announcements.telegramMuteWarning")} &quot;
                      {t("announcements.urgent")}&quot;{" "}
                      {t("announcements.telegramMuteWarningTail")}
                    </p>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Footer */}
              <DialogFooter className="sticky bottom-0 bg-background p-6 pt-4 border-t">
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
          <Card
            key={ann.announcement_id}
            className={ann.is_urgent ? "border-destructive/40" : undefined}
          >
            <CardHeader>
              {/* แก้ล้น: อยู่แถวเดียวกันเสมอ ให้ title เป็นฝั่งที่ wrap แทน */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  {getPriorityIcon(ann)}
                  <div className="min-w-0">
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {/* กันไม่ให้ title ยาว ๆ ดันเลย์เอาต์จนล้น */}
                      <span className="break-words">{ann.title}</span>
                      {ann.is_urgent === 1 && (
                        <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {t("announcements.urgentBadge")}
                        </span>
                      )}
                      {isExpired(ann) && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
                          {t("status.expired")}
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {getAudienceLabel(ann.target_audience)}
                      {ann.target_floor
                        ? ` · ${t("announcements.floorBadge")} ${ann.target_floor}`
                        : ""}
                      {ann.expires_at
                        ? ` · ${t("announcements.expires")} ${formatDate(ann.expires_at)}`
                        : ""}
                    </CardDescription>
                  </div>
                </div>

                {/* shrink-0 กันปุ่มโดนบีบ, size="icon" ให้ปุ่มพอดีตัวไอคอน ไม่บวม */}
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleEdit(ann)}
                    aria-label={t("common.edit")}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleDelete(ann)}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>{ann.content}</CardContent>
          </Card>
        ))
      )}
      {ConfirmDialog}
    </div>
  );
}
