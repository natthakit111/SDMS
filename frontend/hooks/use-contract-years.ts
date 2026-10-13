import { useEffect, useState } from "react";
import { contractAPI } from "@/lib/api/contract.api";

interface YearRange {
  start_year: number;
  end_year: number;
}

export function useContractYears(): number[] {
  const currentYear = new Date().getFullYear();
  const [years, setYears] = useState<number[]>([currentYear]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await contractAPI.getYears();
        const ranges: YearRange[] = res?.data ?? res ?? [];
        // ใส่ปีปัจจุบันเสมอ เพราะเป็นค่าเริ่มต้นของฟอร์ม
        const set = new Set<number>([currentYear]);
        for (const r of ranges) {
          const start = Number(r.start_year);
          // กันข้อมูลผิดปกติไม่ให้ loop ยาวเกินไป
          const end = Math.min(Number(r.end_year), start + 50);
          for (let y = start; y <= end; y++) set.add(y);
        }
        if (!cancelled) setYears([...set].sort((a, b) => b - a));
      } catch {
        /* โหลดไม่ได้ก็ใช้ปีปัจจุบันเป็นค่าสำรอง */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentYear]);

  return years;
}
