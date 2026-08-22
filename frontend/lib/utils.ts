//frontend/lib/utils.ts

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export type Locale = "th" | "en";

const localeMap: Record<Locale, string> = {
  th: "th-TH",
  en: "en-US",
};

export function formatDate(dateString: string, locale: Locale = "th") {
  return new Date(dateString).toLocaleDateString(localeMap[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ── Date formatting helpers ──────────────────────────────────────────────

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function todayDateString(): string {
  return toISODate(new Date());
}

// ── Bilingual month/day names (ใช้กับ DatePickerField) ──────────────────

export const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const DAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
export const DAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];