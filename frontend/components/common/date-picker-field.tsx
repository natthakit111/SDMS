// frontend/components/common/date-picker-field.tsx

"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, MONTHS_TH, MONTHS_EN, toISODate } from "@/lib/utils";

interface DatePickerFieldProps {
  id?: string;
  value: string; // ISO date string, e.g. "2026-08-18"
  onChange: (value: string) => void;
  language: "th" | "en";
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  minDate?: string; // ISO date string — dates before this are disabled
  maxDate?: string;
}

export function DatePickerField({
  id,
  value,
  onChange,
  language,
  required,
  disabled,
  placeholder,
  minDate,
  maxDate,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const months = language === "th" ? MONTHS_TH : MONTHS_EN;

  // ⚠️ ตัด T00:00:00 ตรงๆ กัน new Date("YYYY-MM-DD") ตีความเป็น UTC แล้ว
  // เลื่อนวันไปวันก่อนหน้าตอนแสดงผลในโซนเวลาที่ช้ากว่า UTC
  const selectedDate = value ? new Date(`${value}T00:00:00`) : undefined;

  const label = selectedDate
    ? `${selectedDate.getDate()} ${months[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
    : placeholder || (language === "th" ? "เลือกวันที่" : "Select date");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date: Date | undefined) => {
            if (date) onChange(toISODate(date));
            setOpen(false);
          }}
          disabled={(date: Date) => {
            if (minDate && date < new Date(`${minDate}T00:00:00`)) return true;
            if (maxDate && date > new Date(`${maxDate}T00:00:00`)) return true;
            return false;
          }}
          required={required}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
