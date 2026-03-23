//rooms/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/language-context";
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
import { RoomStatusBadge } from "@/components/common/status-badge";
import { Plus, Search, Pencil, Trash2, DoorOpen, Loader2 } from "lucide-react";
import { roomAPI } from "@/lib/api/room.api";
import { settingsAPI } from "@/lib/api/settings.api";
import { toast } from "sonner";

interface Room {
  room_id: number;
  room_number: string;
  floor: number;
  room_type: string;
  area_sqm: number | null;
  base_rent: number;
  status: "available" | "occupied" | "maintenance";
  description: string | null;
}

interface FormData {
  room_number: string;
  floor: string;
  room_type: string;
  base_rent: string;
  area_sqm: string;
  status: "available" | "occupied" | "maintenance";
  description: string;
}

const emptyForm: FormData = {
  room_number: "",
  floor: "1",
  room_type: "standard",
  base_rent: "",
  area_sqm: "",
  status: "available",
  description: "",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);

export default function RoomsPage() {
  const { t } = useLanguage();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [numFloors, setNumFloors] = useState(5);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const [roomRes, settingsRes] = await Promise.all([
        roomAPI.getAll(
          statusFilter !== "all" ? { status: statusFilter } : undefined,
        ),
        settingsAPI.getAll().catch(() => null),
      ]);
      setRooms(roomRes.data ?? []);
      const s = settingsRes?.data ?? settingsRes ?? {};
      setNumFloors(parseInt(s.num_floors ?? "5") || 5);
    } catch {
      toast.error(t("common.noData"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const filteredRooms = rooms.filter((r) =>
    r.room_number.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        room_number: formData.room_number,
        floor: parseInt(formData.floor),
        room_type: formData.room_type,
        base_rent: parseFloat(formData.base_rent),
        area_sqm: formData.area_sqm ? parseFloat(formData.area_sqm) : undefined,
        status: formData.status,
        description: formData.description || undefined,
      };
      if (editingRoom) {
        await roomAPI.update(editingRoom.room_id, payload);
        toast.success(t("common.save"));
      } else {
        await roomAPI.create(payload);
        toast.success(t("rooms.add"));
      }
      resetForm();
      fetchRooms();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number,
      floor: room.floor.toString(),
      room_type: room.room_type,
      base_rent: room.base_rent.toString(),
      area_sqm: room.area_sqm?.toString() ?? "",
      status: room.status,
      description: room.description ?? "",
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (room: Room) => {
    if (room.status === "occupied") {
      toast.error(t("rooms.cannotDeleteOccupied"));
      return;
    }
    if (!confirm(`${t("common.delete")} ${room.room_number}?`)) return;
    try {
      await roomAPI.delete(room.room_id);
      toast.success(t("common.delete"));
      fetchRooms();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Error");
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingRoom(null);
    setIsAddDialogOpen(false);
  };
  const set =
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData((p) => ({ ...p, [field]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("rooms.title")}</h1>
          <p className="text-muted-foreground">{t("rooms.subtitle")}</p>
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
              {t("rooms.add")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingRoom ? t("common.edit") : t("rooms.add")}
              </DialogTitle>
              <DialogDescription>
                {editingRoom ? t("common.edit") : t("rooms.add")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>{t("rooms.roomNumber")}</FieldLabel>
                    <Input
                      value={formData.room_number}
                      onChange={set("room_number")}
                      placeholder="101"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("rooms.floor")}</FieldLabel>
                    <Select
                      value={formData.floor}
                      onValueChange={(v) =>
                        setFormData((p) => ({ ...p, floor: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: numFloors }, (_, i) => i + 1).map(
                          (f) => (
                            <SelectItem key={f} value={f.toString()}>
                              {t("rooms.floor")} {f}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>{t("rooms.type")}</FieldLabel>
                    <Select
                      value={formData.room_type}
                      onValueChange={(v) =>
                        setFormData((p) => ({ ...p, room_type: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">
                          {t("rooms.standard")}
                        </SelectItem>
                        <SelectItem value="deluxe">
                          {t("rooms.deluxe")}
                        </SelectItem>
                        <SelectItem value="suite">
                          {t("rooms.suite")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>{t("common.status")}</FieldLabel>
                    <Select
                      value={formData.status}
                      onValueChange={(v) =>
                        setFormData((p) => ({
                          ...p,
                          status: v as FormData["status"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">
                          {t("status.available")}
                        </SelectItem>
                        <SelectItem value="occupied">
                          {t("status.occupied")}
                        </SelectItem>
                        <SelectItem value="maintenance">
                          {t("status.maintenance")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>{t("rooms.rent")}</FieldLabel>
                    <Input
                      type="number"
                      value={formData.base_rent}
                      onChange={set("base_rent")}
                      placeholder="4500"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t("rooms.area")}</FieldLabel>
                    <Input
                      type="number"
                      value={formData.area_sqm}
                      onChange={set("area_sqm")}
                      placeholder="28"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>{t("common.note")}</FieldLabel>
                  <Input
                    value={formData.description}
                    onChange={set("description")}
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
                <Button type="submit" disabled={submitting}>
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("rooms.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="available">
                  {t("status.available")}
                </SelectItem>
                <SelectItem value="occupied">{t("status.occupied")}</SelectItem>
                <SelectItem value="maintenance">
                  {t("status.maintenance")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5" />
            {t("rooms.list")}
          </CardTitle>
          <CardDescription>
            {filteredRooms.length} {t("rooms.title")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("rooms.roomNumber")}</TableHead>
                  <TableHead>{t("rooms.floor")}</TableHead>
                  <TableHead>{t("rooms.type")}</TableHead>
                  <TableHead>{t("rooms.area")}</TableHead>
                  <TableHead>{t("rooms.rent")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room) => (
                  <TableRow key={room.room_id}>
                    <TableCell className="font-medium">
                      {room.room_number}
                    </TableCell>
                    <TableCell>{room.floor}</TableCell>
                    <TableCell>{room.room_type}</TableCell>
                    <TableCell>
                      {room.area_sqm
                        ? `${room.area_sqm} ${t("rooms.sqm")}`
                        : "-"}
                    </TableCell>
                    <TableCell>{formatCurrency(room.base_rent)}</TableCell>
                    <TableCell>
                      <RoomStatusBadge status={room.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(room)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(room)}
                          disabled={room.status === "occupied"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRooms.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
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
