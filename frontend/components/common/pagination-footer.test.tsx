import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PaginationFooter } from "./pagination-footer";
import { LanguageProvider } from "@/context/language-context";

const renderWithLanguage = (ui: React.ReactElement) =>
  render(<LanguageProvider>{ui}</LanguageProvider>);

describe("PaginationFooter", () => {
  test("total = 0 -> ไม่ render อะไรเลย", () => {
    const { container } = renderWithLanguage(
      <PaginationFooter page={1} limit={20} total={0} totalPages={0} onPageChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("แสดงช่วงรายการ 'แสดง X–Y จาก Z รายการ' ถูกต้อง", () => {
    renderWithLanguage(
      <PaginationFooter page={2} limit={20} total={45} totalPages={3} onPageChange={vi.fn()} />,
    );
    // page 2, limit 20 -> from=21, to=40
    expect(screen.getByText("แสดง 21–40 จาก 45 รายการ")).toBeInTheDocument();
  });

  test("ปุ่ม Previous ถูก disable ที่หน้าแรก และไม่เรียก onPageChange เมื่อคลิก", () => {
    const onPageChange = vi.fn();
    renderWithLanguage(
      <PaginationFooter page={1} limit={20} total={45} totalPages={3} onPageChange={onPageChange} />,
    );
    fireEvent.click(screen.getByLabelText("Go to previous page"));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  test("คลิกปุ่ม Next เรียก onPageChange(page + 1)", () => {
    const onPageChange = vi.fn();
    renderWithLanguage(
      <PaginationFooter page={2} limit={20} total={45} totalPages={3} onPageChange={onPageChange} />,
    );
    fireEvent.click(screen.getByLabelText("Go to next page"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  test("totalPages <= 1 -> ไม่แสดงปุ่มเปลี่ยนหน้า", () => {
    renderWithLanguage(
      <PaginationFooter page={1} limit={20} total={5} totalPages={1} onPageChange={vi.fn()} />,
    );
    expect(screen.queryByLabelText("Go to next page")).not.toBeInTheDocument();
  });
});
