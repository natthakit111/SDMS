import { describe, test, expect } from "vitest";
import { cn, formatCurrency, formatDate, toISODate, todayDateString } from "./utils";

describe("cn", () => {
  test("รวม class name และ merge ค่าที่ซ้ำ/ขัดแย้งกันของ tailwind ให้เหลืออันสุดท้าย", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  test("ข้าม falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("formatCurrency", () => {
  test("จัดรูปแบบเป็นสกุลเงินบาทแบบไม่มีทศนิยม", () => {
    expect(formatCurrency(1500)).toBe("฿1,500");
  });

  test("ปัดเศษทศนิยม", () => {
    expect(formatCurrency(999.6)).toBe("฿1,000");
  });
});

describe("toISODate / todayDateString", () => {
  test("แปลง Date เป็น YYYY-MM-DD โดย pad เลขเดือน/วันที่ให้ครบ 2 หลัก", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05"); // เดือน 0 = มกราคม
  });

  test("todayDateString คืนรูปแบบเดียวกับ toISODate(new Date())", () => {
    expect(todayDateString()).toBe(toISODate(new Date()));
  });
});

describe("formatDate", () => {
  test("แสดงวันที่แบบไทยเป็นค่าเริ่มต้น (พ.ศ.)", () => {
    const result = formatDate("2026-03-15", "th");
    expect(result).toContain("2569"); // ค.ศ.2026 = พ.ศ.2569
  });

  test("แสดงวันที่แบบอังกฤษเมื่อระบุ locale เป็น en", () => {
    const result = formatDate("2026-03-15", "en");
    expect(result).toContain("2026");
    expect(result).toContain("March");
  });
});
