//meters/page.tsx

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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Plus,
  Search,
  Gauge,
  Zap,
  Droplets,
  Pencil,
  Camera,
  CheckCircle,
  Loader2,
  ImageIcon,
  X,
  Home,
  Calendar,
} from "lucide-react";
import { meterAPI } from "@/lib/api/meter.api";
import { getMediaUrl } from "@/lib/media-url";
import { roomAPI } from "@/lib/api/room.api";
import { utilityRateAPI } from "@/lib/api/utilityRate.api";
import { toast } from "sonner";
import { useLanguage } from "@/context/language-context";
import { settingsAPI } from "@/lib/api/settings.api";
import { Room, Reading } from "@/types/index";
import { PaginationFooter } from "@/components/common/pagination-footer";

// จัดกลุ่ม readings ตาม room+month+year
interface GroupedReading {
  key: string;
  room_id: number;
  room_number: string;
  reading_month: number;
  reading_year: number;
  electric: Reading | null;
  water: Reading | null;
}

const imgUrl = (path: string | null) => getMediaUrl(path, "detail");

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// ⚠️ ใหม่: บีบอัดรูปฝั่ง client ก่อนอัปโหลด — กล้องมือถือมักได้ไฟล์
// 8-15MB ซึ่งเกิน MAX_FILE_SIZE_MB=5 ของ backend เกือบทุกครั้ง ทำให้
// admin โดน reject ระหว่างถ่ายมิเตอร์จริงในสนามบ่อยๆ บีบให้เหลือ
// ความกว้างสูงสุด 1600px + คุณภาพ 0.7 พอเพียงให้อ่านตัวเลขมิเตอร์
// ในรูปได้ชัดเจน แต่ขนาดไฟล์เล็กลงมาก
const compressImage = (
  file: File,
  maxWidth = 1600,
  quality = 0.7,
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compress failed"));
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = reject;
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const now = new Date();

export default function MetersPage() {
  const { t } = useLanguage();
  const MONTHS = Array.from({ length: 12 }, (_, i) => t(`month.${i + 1}`));
  const [readings, setReadings] = useState<Reading[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [rates, setRates] = useState<{ electric: number; water: number }>({
    electric: 0,
    water: 0,
  });
  const [waterBillingType, setWaterBillingType] = useState<"unit" | "flat">(
    "unit",
  );
  const [waterFlatRate, setWaterFlatRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");

  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ total: 0, totalPages: 0 });

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingElectric, setEditingElectric] = useState<Reading | null>(null);
  const [editingWater, setEditingWater] = useState<Reading | null>(null);

  // Form
  const [roomId, setRoomId] = useState("");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [elecPrev, setElecPrev] = useState("");
  const [elecCurr, setElecCurr] = useState("");
  const [waterPrev, setWaterPrev] = useState("");
  const [waterCurr, setWaterCurr] = useState("");

  // Images
  const [elecImage, setElecImage] = useState<File | null>(null);
  const [waterImage, setWaterImage] = useState<File | null>(null);
  const [elecPreview, setElecPreview] = useState<string | null>(null);
  const [waterPreview, setWaterPreview] = useState<string | null>(null);
  const elecRef = useRef<HTMLInputElement>(null);
  const waterRef = useRef<HTMLInputElement>(null);

  // Photo view dialog
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<GroupedReading | null>(null);

  // ── ข้อมูลอ้างอิง (ห้อง, อัตราค่าน้ำ-ไฟ, ตั้งค่า) — ดึงครั้งเดียวตอนโหลดหน้า
  // ไม่เกี่ยวกับ page/search/filter ของตารางด้านล่าง ไม่ต้อง refetch ทุกครั้ง
  const fetchReferenceData = useCallback(async () => {
    try {
      const [roomRes, rateRes, settingsRes] = await Promise.all([
        roomAPI.getAll({ status: "occupied" }),
        utilityRateAPI.getCurrent(),
        settingsAPI.getAll().catch(() => ({ data: {} })),
      ]);
      setRooms(roomRes?.data ?? roomRes ?? []);
      const rd = rateRes?.data ?? rateRes ?? {};
      setRates({
        electric: Number(rd.electric?.rate_per_unit ?? 0),
        water: Number(rd.water?.rate_per_unit ?? 0),
      });
      const settings = settingsRes?.data ?? settingsRes ?? {};
      setWaterBillingType(
        settings.water_billing_type === "flat" ? "flat" : "unit",
      );
      setWaterFlatRate(Number(settings.water_flat_rate ?? 0));
    } catch {
      toast.error(t("meters.loadError"));
    }
  }, [t]);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const readRes = await meterAPI.getAll({
        search: searchQuery || undefined,
        month: monthFilter !== "all" ? monthFilter : undefined,
        page,
        limit: PAGE_SIZE,
      });
      setReadings(readRes?.data?.items ?? []);
      setPageMeta({
        total: readRes?.data?.pagination?.total ?? 0,
        totalPages: readRes?.data?.pagination?.totalPages ?? 0,
      });
    } catch {
      toast.error(t("meters.loadError"));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, monthFilter, page, t]);

  useEffect(() => {
    const timer = setTimeout(fetchAll, 300);
    return () => clearTimeout(timer);
  }, [fetchAll]);

  // เปลี่ยน search/filter แล้วต้องกลับไปหน้า 1 เสมอ — ไม่งั้นอาจค้างอยู่หน้า
  // ที่ filter ใหม่ไม่มีข้อมูลถึง
  useEffect(() => {
    setPage(1);
  }, [searchQuery, monthFilter]);

  const fetchAvailableRooms = useCallback(async (m: string, y: string) => {
    try {
      const res = await meterAPI.getAvailableRooms({ month: m, year: y });
      setAvailableRooms(res.data ?? []);
    } catch {
      setAvailableRooms([]);
    }
  }, []);

  useEffect(() => {
    if (dialogOpen && !(editingElectric || editingWater)) {
      fetchAvailableRooms(month, year);
    }
  }, [
    dialogOpen,
    month,
    year,
    editingElectric,
    editingWater,
    fetchAvailableRooms,
  ]);

  // จัดกลุ่ม readings
  const grouped: GroupedReading[] = (() => {
    const map = new Map<string, GroupedReading>();
    readings.forEach((r) => {
      // 💡 กันเหนียวสำหรับ TypeScript (Fallback values)
      const roomId = r.room_id ?? 0;
      const roomNum = r.room_number ?? "";
      const rMonth = r.reading_month ?? 0;
      const rYear = r.reading_year ?? 0;

      const key = `${roomId}-${rMonth}-${rYear}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          room_id: roomId,
          room_number: roomNum,
          reading_month: rMonth,
          reading_year: rYear,
          electric: null,
          water: null,
        });
      }
      const g = map.get(key)!;
      if (r.meter_type === "electric") {
        g.electric = r;
      } else {
        g.water = r;
      }
    });
    return Array.from(map.values());
  })();

  // ⚠️ search/month filter ย้ายไปทำที่ backend แล้ว (ดู meter.model.js) เพื่อ
  // ให้ total/pagination ถูกต้องตามหน้าที่แบ่งจริง — grouped คือข้อมูลของ
  // หน้าปัจจุบันที่ filter มาจาก backend เรียบร้อยแล้ว ไม่ต้อง filter ซ้ำ
  const filtered = grouped;

  const handleRoomChange = async (rid: string) => {
    setRoomId(rid);
    setElecPrev("");
    setWaterPrev("");
    if (!rid) return;
    try {
      const [elec, water] = await Promise.all([
        meterAPI.getPreviousReading(rid, "electric").catch(() => null),
        meterAPI.getPreviousReading(rid, "water").catch(() => null),
      ]);
      const elecData = elec?.data ?? elec;
      const waterData = water?.data ?? water;
      if (elecData?.previous_unit !== undefined)
        setElecPrev(String(elecData.previous_unit));
      if (waterData?.previous_unit !== undefined)
        setWaterPrev(String(waterData.previous_unit));
    } catch {}
  };

  const handleElecImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setElecImage(null);
      setElecPreview(null);
      return;
    }
    try {
      const compressed = await compressImage(f);
      setElecImage(compressed);
      setElecPreview(URL.createObjectURL(compressed));
    } catch {
      // compress พลาด — ใช้ไฟล์ต้นฉบับแทน ดีกว่าบล็อกไม่ให้อัปโหลดเลย
      setElecImage(f);
      setElecPreview(URL.createObjectURL(f));
    }
  };

  const handleWaterImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setWaterImage(null);
      setWaterPreview(null);
      return;
    }
    try {
      const compressed = await compressImage(f);
      setWaterImage(compressed);
      setWaterPreview(URL.createObjectURL(compressed));
    } catch {
      setWaterImage(f);
      setWaterPreview(URL.createObjectURL(f));
    }
  };

  const resetDialog = () => {
    setRoomId("");
    setMonth(String(now.getMonth() + 1));
    setYear(String(now.getFullYear()));
    setElecPrev("");
    setElecCurr("");
    setWaterPrev("");
    setWaterCurr("");
    setElecImage(null);
    setWaterImage(null);
    setElecPreview(null);
    setWaterPreview(null);
    setEditingElectric(null);
    setEditingWater(null);
    setDialogOpen(false);
  };

  const openEdit = (g: GroupedReading) => {
    setEditingElectric(g.electric);
    setEditingWater(g.water);
    setRoomId(String(g.room_id));
    setMonth(String(g.reading_month));
    setYear(String(g.reading_year));
    setElecPrev(String(g.electric?.previous_unit ?? ""));
    setElecCurr(String(g.electric?.current_unit ?? ""));
    setWaterPrev(String(g.water?.previous_unit ?? ""));
    setWaterCurr(String(g.water?.current_unit ?? ""));
    // แสดงรูปเดิม
    setElecPreview(imgUrl(g.electric?.image_path ?? null));
    setWaterPreview(imgUrl(g.water?.image_path ?? null));
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!roomId) {
      toast.error(t("meters.errorSelectRoom"));
      return;
    }
    if (!elecCurr && !waterCurr) {
      toast.error(t("meters.errorAtLeastOne"));
      return;
    }

    const isEditing = !!(editingElectric || editingWater);
    const errors: string[] = [];

    if (elecCurr && Number(elecCurr) < Number(elecPrev))
      errors.push(t("meters.errorElecOrder"));
    if (waterCurr && Number(waterCurr) < Number(waterPrev))
      errors.push(t("meters.errorWaterOrder"));
    if (errors.length) {
      toast.error(errors.join(" | "));
      return;
    }

    try {
      setSubmitting(true);

      // บันทึกไฟฟ้า
      if (elecCurr) {
        const data = {
          room_id: roomId,
          meter_type: "electric",
          reading_month: month,
          reading_year: year,
          current_unit: elecCurr,
        };
        if (editingElectric) {
          await meterAPI.update(
            editingElectric.reading_id,
            { current_unit: elecCurr },
            elecImage || undefined,
          );
        } else {
          await meterAPI.create(data, elecImage || undefined);
        }
      }

      // บันทึกน้ำ
      if (waterCurr) {
        const data = {
          room_id: roomId,
          meter_type: "water",
          reading_month: month,
          reading_year: year,
          current_unit: waterCurr,
        };
        if (editingWater) {
          await meterAPI.update(
            editingWater.reading_id,
            { current_unit: waterCurr },
            waterImage || undefined,
          );
        } else {
          await meterAPI.create(data, waterImage || undefined);
        }
      }

      toast.success(
        isEditing ? t("meters.updateSuccess") : t("meters.saveSuccess"),
      );
      resetDialog();
      fetchAll();
    } catch (err: any) {
      const errCode = err?.response?.data?.error_code as string | undefined;
      const errMsg = errCode
        ? t(errCode) !== errCode // key พบใน translations
          ? t(errCode)
          : err?.response?.data?.message // fallback ข้อความ raw จาก server
        : (err?.response?.data?.message ?? t("meters.saveError"));
      toast.error(errMsg ?? t("meters.saveError"));
    } finally {
      setSubmitting(false);
    }
  };

  const years = Array.from({ length: 3 }, (_, i) =>
    String(now.getFullYear() - i + 1),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("meters.title")}</h1>
          <p className="text-muted-foreground">{t("meters.subtitle")}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("meters.addBtn")}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("meters.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t("meters.allMonths")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("meters.allMonths")}</SelectItem>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table/Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            {t("meters.listTitle")}
          </CardTitle>
          <CardDescription>
            {t("meters.totalItems").replace("{n}", String(pageMeta.total))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("meters.notFound")}
            </div>
          ) : (
            <>
              {/* ── Desktop: table ───────────────────────────────────── */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("meters.colRoom")}</TableHead>
                    <TableHead>{t("meters.colMonthYear")}</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        {t("meters.colElectric")}
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Droplets className="h-4 w-4 text-blue-500" />
                        {t("meters.colWater")}
                      </div>
                    </TableHead>
                    <TableHead>{t("meters.colRecordedAt")}</TableHead>
                    <TableHead className="text-right">
                      {t("common.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((g) => (
                    <TableRow key={g.key}>
                      <TableCell className="font-medium">
                        {g.room_number}
                      </TableCell>
                      <TableCell>
                        {MONTHS[g.reading_month - 1]} {g.reading_year}
                      </TableCell>
                      <TableCell className="text-center">
                        {g.electric ? (
                          <div className="flex items-center justify-center gap-1 text-sm">
                            <span className="text-muted-foreground">
                              {g.electric.previous_unit}
                            </span>
                            {" → "}
                            <span>{g.electric.current_unit}</span>
                            <span className="text-primary font-medium ml-1">
                              ({g.electric.units_used})
                            </span>
                            {g.electric.image_path && (
                              <CheckCircle className="h-4 w-4 text-success ml-1" />
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {g.water ? (
                          <div className="flex items-center justify-center gap-1 text-sm">
                            <span className="text-muted-foreground">
                              {g.water.previous_unit}
                            </span>
                            {" → "}
                            <span>{g.water.current_unit}</span>
                            <span className="text-primary font-medium ml-1">
                              ({g.water.units_used})
                            </span>
                            {g.water.image_path && (
                              <CheckCircle className="h-4 w-4 text-success ml-1" />
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(
                          g.electric?.recorded_at ?? g.water?.recorded_at ?? "",
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("meters.viewPhotos")}
                            onClick={() => {
                              setViewingGroup(g);
                              setPhotoDialogOpen(true);
                            }}
                          >
                            <Camera className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(g)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* ── Mobile: card list ──────────────────────────────────
            ⚠️ ใหม่: เดิมใช้ table เดียวกันทุกขนาดจอ ตัวเลขมิเตอร์
            (previous → current (used)) ถูกอัดในเซลล์เล็กจนอ่านยาก
            บนจอแคบ แถมยังมีคอลัมน์วันที่บันทึกที่ต้อง scroll ขวา
            ไปดู — ตอนนี้แยกไฟฟ้า/น้ำเป็นคนละบรรทัดในการ์ด อ่านง่ายขึ้น */}
              <div className="md:hidden space-y-3">
                {filtered.map((g) => (
                  <div key={g.key} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Home className="h-3.5 w-3.5 text-muted-foreground" />
                        {g.room_number}
                      </div>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {MONTHS[g.reading_month - 1]} {g.reading_year}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Zap className="h-3.5 w-3.5 text-yellow-500" />
                          {t("meters.colElectric")}
                        </span>
                        {g.electric ? (
                          <span className="flex items-center gap-1">
                            {g.electric.previous_unit} →{" "}
                            {g.electric.current_unit}
                            <span className="text-primary font-medium">
                              ({g.electric.units_used})
                            </span>
                            {g.electric.image_path && (
                              <CheckCircle className="h-3.5 w-3.5 text-success" />
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Droplets className="h-3.5 w-3.5 text-blue-500" />
                          {t("meters.colWater")}
                        </span>
                        {g.water ? (
                          <span className="flex items-center gap-1">
                            {g.water.previous_unit} → {g.water.current_unit}
                            <span className="text-primary font-medium">
                              ({g.water.units_used})
                            </span>
                            {g.water.image_path && (
                              <CheckCircle className="h-3.5 w-3.5 text-success" />
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {t("meters.colRecordedAt")}:{" "}
                      {formatDate(
                        g.electric?.recorded_at ?? g.water?.recorded_at ?? "",
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setViewingGroup(g);
                          setPhotoDialogOpen(true);
                        }}
                      >
                        <Camera className="h-4 w-4 mr-1.5" />
                        {t("meters.viewPhotos")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openEdit(g)}
                      >
                        <Pencil className="h-4 w-4 mr-1.5" />
                        {t("common.edit") ?? "แก้ไข"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <PaginationFooter
                page={page}
                limit={PAGE_SIZE}
                total={pageMeta.total}
                totalPages={pageMeta.totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) resetDialog();
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingElectric || editingWater
                ? t("meters.editTitle")
                : t("meters.addTitle")}
            </DialogTitle>
            <DialogDescription>{t("meters.dialogDesc")}</DialogDescription>
          </DialogHeader>

          <FieldGroup>
            {/* Room / Month / Year */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              <Field className="col-span-2 sm:col-span-1">
                <FieldLabel>{t("contracts.room")}</FieldLabel>
                <Select
                  value={roomId}
                  onValueChange={handleRoomChange}
                  disabled={!!(editingElectric || editingWater)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("contracts.selectRoom")} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* ⚠️ แก้: ตอนแก้ไข (edit) เราไม่ได้ fetch availableRooms
                        เลย ทำให้ value={roomId} ไม่มี SelectItem ที่ match →
                        ช่องห้องโชว์ว่างเปล่า. เพิ่ม item ของห้องปัจจุบันเข้าไป
                        เพื่อให้แสดงเลขห้องได้ถูกต้องในโหมดแก้ไข */}
                    {editingElectric || editingWater ? (
                      <SelectItem value={roomId}>
                        {(editingElectric ?? editingWater)?.room_number ??
                          roomId}
                      </SelectItem>
                    ) : (
                      availableRooms.map((r) => (
                        <SelectItem key={r.room_id} value={String(r.room_id)}>
                          {r.room_number}
                          {r.tenant_name ? ` (${r.tenant_name})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{t("bills.month")}</FieldLabel>
                <Select
                  value={month}
                  onValueChange={(v) => {
                    setMonth(v);
                    setRoomId("");
                  }}
                  disabled={!!(editingElectric || editingWater)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{t("bills.year")}</FieldLabel>
                <Select
                  value={year}
                  onValueChange={(v) => {
                    setYear(v);
                    setRoomId("");
                  }}
                  disabled={!!(editingElectric || editingWater)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {/* Electricity */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-yellow-500" />
                {t("meters.electricMeter")}
                <span className="text-muted-foreground ml-auto text-xs">
                  ({t("meters.rate")} {rates.electric} {t("meters.bahtPerUnit")}
                  )
                </span>
                {(elecImage || elecPreview) && (
                  <CheckCircle className="h-4 w-4 text-success" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>{t("meters.previousUnit")}</FieldLabel>
                  <Input
                    type="number"
                    value={elecPrev}
                    onChange={(e) => setElecPrev(e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("meters.currentUnit")}</FieldLabel>
                  <Input
                    type="number"
                    value={elecCurr}
                    onChange={(e) => setElecCurr(e.target.value)}
                    placeholder="0"
                  />
                </Field>
              </div>
              {/* รูปมิเตอร์ไฟ */}
              <div className="space-y-2">
                <FieldLabel>{t("meters.elecPhotoLabel")}</FieldLabel>
                <input
                  ref={elecRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleElecImage}
                />
                {elecPreview ? (
                  <div className="relative">
                    <img
                      src={elecPreview}
                      alt={t("meters.electricMeter")}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => {
                        setElecImage(null);
                        setElecPreview(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => elecRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    {t("meters.uploadElecPhoto")}
                  </Button>
                )}
              </div>
            </div>
            {/* Water */}
            {waterBillingType === "flat" ? (
              <div className="p-4 bg-info/10 border border-info/30 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium text-info">
                  <Droplets className="h-4 w-4" />
                  {t("meters.waterMeter")}
                  <span className="ml-auto text-xs bg-info/20 px-2 py-0.5 rounded-full">
                    {t("meters.flatRate")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {t("meters.flatRateDesc")}{" "}
                  <span className="font-bold text-foreground">
                    ฿{waterFlatRate}
                  </span>{" "}
                  {t("meters.perMonth")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("meters.flatRateNoMeter")}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  {t("meters.waterMeter")}
                  <span className="text-muted-foreground ml-auto text-xs">
                    ({t("meters.rate")} {rates.water} {t("meters.bahtPerUnit")})
                  </span>
                  {(waterImage || waterPreview) && (
                    <CheckCircle className="h-4 w-4 text-success" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>{t("meters.previousUnit")}</FieldLabel>
                    <Input
                      type="number"
                      value={waterPrev}
                      onChange={(e) => setWaterPrev(e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("meters.currentUnit")}</FieldLabel>
                    <Input
                      type="number"
                      value={waterCurr}
                      onChange={(e) => setWaterCurr(e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                </div>
                {/* รูปมิเตอร์น้ำ */}
                <div className="space-y-2">
                  <FieldLabel>{t("meters.waterPhotoLabel")}</FieldLabel>
                  <input
                    ref={waterRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleWaterImage}
                  />
                  {waterPreview ? (
                    <div className="relative">
                      <img
                        src={waterPreview}
                        alt={t("meters.waterMeter")}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => {
                          setWaterImage(null);
                          setWaterPreview(null);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => waterRef.current?.click()}
                    >
                      <Camera className="h-4 w-4" />
                      {t("meters.uploadWaterPhoto")}
                    </Button>
                  )}
                </div>
              </div>
            )}{" "}
            {/* end waterBillingType */}
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={resetDialog}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingElectric || editingWater
                ? t("common.save")
                : t("meters.addBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo View Dialog */}
      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("meters.photoDialogTitle")} {viewingGroup?.room_number} —{" "}
              {viewingGroup && MONTHS[viewingGroup.reading_month - 1]}{" "}
              {viewingGroup?.reading_year}
            </DialogTitle>
          </DialogHeader>
          {viewingGroup && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  {t("meters.electricMeter")}
                </div>
                {viewingGroup.electric?.image_path ? (
                  <img
                    src={imgUrl(viewingGroup.electric.image_path) ?? ""}
                    alt={t("meters.electricMeter")}
                    className="w-full rounded-lg object-contain max-h-64 bg-muted"
                  />
                ) : (
                  <div className="flex items-center justify-center h-32 bg-muted rounded-lg">
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">{t("meters.noPhoto")}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  {t("meters.waterMeter")}
                </div>
                {viewingGroup.water?.image_path ? (
                  <img
                    src={imgUrl(viewingGroup.water.image_path) ?? ""}
                    alt={t("meters.waterMeter")}
                    className="w-full rounded-lg object-contain max-h-64 bg-muted"
                  />
                ) : (
                  <div className="flex items-center justify-center h-32 bg-muted rounded-lg">
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">{t("meters.noPhoto")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
