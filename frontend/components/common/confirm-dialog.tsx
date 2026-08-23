// frontend/components/common/confirm-dialog.tsx
// ⚠️ FIX: เดิมทุกหน้าที่ต้องยืนยันก่อนลบ/ยกเลิก (tenants, rooms, contracts,
// bills, announcements, move-out) ใช้ window.confirm() ของเบราว์เซอร์ —
// เป็น native dialog ที่ไม่มีทางปรับสไตล์ได้เลย ไม่ตามธีมมืด/สว่างของเว็บ
// (โผล่มาเป็นกล่องขาวของเบราว์เซอร์เสมอ ตัดกับหน้าเว็บ) เปลี่ยนมาใช้
// AlertDialog (theme-aware อยู่แล้ว ดู components/ui/alert-dialog.tsx) ผ่าน
// hook นี้แทน — เรียกใช้แบบเดียวกับ window.confirm() เดิมได้เลย
// (await confirm(message) คืนค่า true/false) แค่ต้อง render <ConfirmDialog />
// ไว้ในหน้าด้วย 1 จุด

"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/context/language-context";

export function useConfirmDialog() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((msg: string) => {
    setMessage(msg);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  // ครอบคลุมทุกทางที่ dialog ปิดโดยไม่ได้กดยืนยัน — กด Cancel, กด Escape,
  // หรือคลิกนอกกล่อง (ทั้งหมดสั่ง onOpenChange(false) เหมือนกันหมด)
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const handleConfirm = () => {
    resolverRef.current?.(true);
    resolverRef.current = null;
  };

  const ConfirmDialog = (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("common.confirmAction")}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line text-foreground/80">
            {message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            {t("common.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}
