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
} from "lucide-react";
import { meterAPI } from "@/lib/api/meter.api";
import { roomAPI } from "@/lib/api/room.api";
import { utilityRateAPI } from "@/lib/api/utilityRate.api";
import { toast } from "sonner";
import { useLanguage } from "@/context/language-context";

// Month names are generated from t("month.N") inside the component

interface Room {
  room_id: number;
  room_number: string;
  status: string;
}

interface Reading {
  reading_id: number;
  room_id: number;
  room_number: string;
  meter_type: "electric" | "water";
  reading_month: number;
  reading_year: number;
  previous_unit: number;
  current_unit: number;
  units_used: number;
  rate_per_unit: number;
  image_path: string | null;
  recorded_at: string;
}

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

const imgUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_API_URL ?? ""}/${path}`;
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

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

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [readRes, roomRes, rateRes, settingsRes] = await Promise.all([
        meterAPI.getAll(),
        roomAPI.getAll({ status: "occupied" }),
        utilityRateAPI.getCurrent(),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        })
          .then((r) => r.json())
          .catch(() => ({ data: {} })),
      ]);
      setReadings(readRes?.data ?? readRes ?? []);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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
      const key = `${r.room_id}-${r.reading_month}-${r.reading_year}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          room_id: r.room_id,
          room_number: r.room_number,
          reading_month: r.reading_month,
          reading_year: r.reading_year,
          electric: null,
          water: null,
        });
      }
      const g = map.get(key)!;
      if (r.meter_type === "electric") g.electric = r;
      else g.water = r;
    });
    return Array.from(map.values());
  })();

  const filtered = grouped.filter((g) => {
    const matchSearch = g.room_number
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchMonth =
      monthFilter === "all" || String(g.reading_month) === monthFilter;
    return matchSearch && matchMonth;
  });

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

  const handleElecImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setElecImage(f);
    setElecPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleWaterImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setWaterImage(f);
    setWaterPreview(f ? URL.createObjectURL(f) : null);
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

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            {t("meters.listTitle")}
          </CardTitle>
          <CardDescription>
            {t("meters.totalItems").replace("{n}", String(filtered.length))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
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
                          {/* ✅ badge รูป */}
                          {g.electric.image_path && (
                            <CheckCircle className="h-4 w-4 text-green-500 ml-1" />
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
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
                            <CheckCircle className="h-4 w-4 text-green-500 ml-1" />
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
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
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {t("meters.notFound")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
            <div className="grid grid-cols-3 gap-4">
              <Field className="col-span-1">
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
                    {availableRooms.map((r) => (
                      <SelectItem key={r.room_id} value={String(r.room_id)}>
                        {r.room_number}
                      </SelectItem>
                    ))}
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
                  <CheckCircle className="h-4 w-4 text-green-500" />
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
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
                  <Droplets className="h-4 w-4" />
                  {t("meters.waterMeter")}
                  <span className="ml-auto text-xs bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full">
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
                    <CheckCircle className="h-4 w-4 text-green-500" />
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
            <div className="grid grid-cols-2 gap-4">
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
