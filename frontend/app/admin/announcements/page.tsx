//frontend/app/admin/announcements/page.tsx

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
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
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
  is_urgent: number;
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

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// ── Bilingual date picker (copy จาก admin/bills/page.tsx เพื่อให้ปฏิทิน
//    หน้าตาเหมือนกันทั้งระบบ — แสดง พ.ศ. ตอนภาษาไทย, ค.ศ. ตอนอังกฤษ,
//    ไม่ใช่ input type="date" ดิบของเบราว์เซอร์ที่ locale ผูกกับเครื่องผู้ใช้เอง) ──

const MONTHS_TH = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function DatePickerField({
  id,
  value,
  onChange,
  language,
  required,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  language: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(
    value ? new Date(value + "T00:00:00") : new Date(),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setViewDate(new Date(value + "T00:00:00"));
  }, [value]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const months = language === "th" ? MONTHS_TH : MONTHS_EN;
  const days = language === "th" ? DAYS_TH : DAYS_EN;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const displayYear = language === "th" ? year + 543 : year;
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selected = value ? new Date(value + "T00:00:00") : null;

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isSelected = (day: number) =>
    !!selected &&
    selected.getFullYear() === year &&
    selected.getMonth() === month &&
    selected.getDate() === day;

  const isToday = (day: number) => {
    const now = new Date();
    return (
      now.getFullYear() === year &&
      now.getMonth() === month &&
      now.getDate() === day
    );
  };

  const label = value
    ? new Date(value + "T00:00:00").toLocaleDateString(
        language === "th" ? "th-TH" : "en-US",
        { year: "numeric", month: "short", day: "numeric" },
      )
    : (placeholder ?? (language === "th" ? "เลือกวันที่" : "Select date"));

  return (
    <div className="relative" ref={containerRef}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus:ring-2 focus:ring-ring/50"
      >
        <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className={value ? "" : "text-muted-foreground"}>{label}</span>
      </button>

      {required && (
        <input
          tabIndex={-1}
          value={value}
          required
          onChange={() => {}}
          className="sr-only"
        />
      )}

      {open && (
        <div className="absolute left-0 bottom-full mb-2 z-[100] w-64 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg sm:bottom-auto sm:top-full sm:mt-2">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              className="p-1 rounded hover:bg-muted"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">
              {months[month]} {displayYear}
            </span>
            <button
              type="button"
              className="p-1 rounded hover:bg-muted"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1 text-center text-xs text-muted-foreground">
            {days.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) =>
              day === null ? (
                <div key={idx} />
              ) : (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onChange(toISODate(new Date(year, month, day)));
                    setOpen(false);
                  }}
                  className={`h-8 w-8 rounded-md text-sm hover:bg-muted transition-colors ${
                    isSelected(day)
                      ? "bg-primary text-primary-foreground hover:bg-primary"
                      : isToday(day)
                        ? "border border-primary"
                        : ""
                  }`}
                >
                  {day}
                </button>
              ),
            )}
          </div>

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                const today = new Date();
                setViewDate(today);
                onChange(toISODate(today));
                setOpen(false);
              }}
            >
              {language === "th" ? "วันนี้" : "Today"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Telegram preview helpers ──────────────────────────────────────────────────
// จำลองข้อความให้ตรงกับรูปแบบจริงที่ telegram.service.js -> broadcastAnnouncement
// ประกอบขึ้น (📢/🚨 + หัวข้อ + ตัวหนา + เนื้อหา) ผู้ดูแลจะได้เห็นก่อนกดส่งจริง
const buildPreviewText = (form: FormData) => {
  const urgentTag = form.is_urgent ? "🚨 " : "";
  const floorLabel = form.target_floor ? ` (ชั้น ${form.target_floor})` : "";
  return {
    header: `📢 ${urgentTag}ประกาศจากหอพัก${floorLabel}`,
    title: form.title || "หัวข้อประกาศจะแสดงตรงนี้",
    content: form.content || "เนื้อหาประกาศจะแสดงตรงนี้",
  };
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const { t, language } = useLanguage();

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
    if (ann.is_urgent)
      return <AlertTriangle className="h-5 w-5 text-destructive" />;
    if (ann.is_pinned) return <Pin className="h-5 w-5 text-yellow-500" />;
    if (ann.target_audience === "admin")
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    return <Info className="h-5 w-5 text-primary" />;
  };

  const isExpired = (ann: Announcement) =>
    ann.expires_at ? new Date(ann.expires_at) < new Date() : false;

  const preview = buildPreviewText(formData);

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
            เดิม dialog กว้าง max-w-lg คอลัมน์เดียว — ตอนนี้ขยายเป็น 2 คอลัมน์บนจอกว้าง
            (ฟอร์มซ้าย + live preview ข้อความ Telegram ขวา) เพื่อให้แอดมินเห็นว่า
            ข้อความจะไปโผล่หน้าตาแบบไหนจริงก่อนกดส่ง — บนจอแคบยุบเหลือคอลัมน์เดียว
            preview เลื่อนไปอยู่บนสุดของฟอร์มแทน

            ยังคง fix เดิมไว้: flex column ความสูงจำกัด, body เลื่อนได้, footer ติดล่างเสมอ
          */}
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 gap-0">
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

            {/*
              ลองมาแล้ว 2 แบบ: (1) 2 คอลัมน์ตลอด — สูงเกินจอ (2) flex+ScrollArea+Tabs
              ที่บังคับความสูงเอง — footer ทับเนื้อหา (bug จาก flex chain ที่ผิดพลาด)
              กลับมาใช้วิธีเรียบง่ายที่สุดที่พิสูจน์แล้วว่าใช้ได้จริงในโปรเจกต์นี้
              (เหมือน maintenance/page.tsx): ให้ DialogContent ทั้งกล่อง scroll เอง
              ตรงๆ ด้วย overflow-y-auto ธรรมดา ไม่ต้องคำนวณความสูงเอง — Header/Footer
              แค่ sticky ติดขอบบน-ล่างของกล่องที่ scroll อยู่แล้ว ไม่มีทางทับเนื้อหา
            */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-6">
                <Tabs defaultValue="form">
                  <TabsList className="w-full grid grid-cols-2 mb-4">
                    <TabsTrigger value="form">แก้ไขประกาศ</TabsTrigger>
                    <TabsTrigger
                      value="preview"
                      disabled={formData.target_audience === "admin"}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      ตัวอย่าง Telegram
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
                          placeholder="เช่น แจ้งซ่อมลิฟต์ชั่วคราว"
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
                          placeholder="รายละเอียดประกาศ..."
                          required
                        />
                      </Field>
                    </FieldGroup>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Users className="h-4 w-4" />
                        กลุ่มเป้าหมายและการเข้าถึง
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
                        ความสำคัญและระยะเวลา
                      </div>

                      <div className="flex items-center justify-between rounded-md border p-3">
                        <div className="flex items-center gap-2">
                          <Pin className="h-4 w-4 text-yellow-500" />
                          <div>
                            <p className="text-sm font-medium">
                              ปักหมุดไว้บนสุด
                            </p>
                            <p className="text-xs text-muted-foreground">
                              แสดงในหัวข้อ &quot;ประกาศสำคัญ&quot; ของผู้เช่า
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
                            (ไม่บังคับ)
                          </span>
                        </FieldLabel>
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
                      ตัวอย่างข้อความที่ผู้เช่าจะเห็นใน Telegram
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
                      ผู้เช่าที่ปิดการแจ้งเตือน &quot;ประกาศทั่วไป&quot;
                      ไว้จะไม่ได้รับ ข้อความนี้ ยกเว้นติ๊ก &quot;
                      {t("announcements.urgent")}&quot; ซึ่งจะส่งถึงทุกคนเสมอ
                    </p>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Footer ติดขอบล่างของกล่องที่ scroll อยู่ — sticky ธรรมดา ไม่ใช่ flex */}
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
              <div className="flex justify-between">
                <div className="flex gap-3">
                  {getPriorityIcon(ann)}
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {ann.title}
                      {ann.is_urgent === 1 && (
                        <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                          {t("announcements.urgentBadge")}
                        </span>
                      )}
                      {isExpired(ann) && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
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
