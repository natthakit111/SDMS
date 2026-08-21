// frontend/components/common/pagination-footer.tsx
// แถบ pagination มาตรฐานที่ใช้ร่วมกันทุกหน้าตาราง (list) ฝั่งแอดมิน
// รับ state จาก parent ล้วนๆ (ไม่ผูก URL) — parent เป็นคนยิง API ใหม่ทุกครั้งที่ page เปลี่ยน

"use client";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { useLanguage } from "@/context/language-context";

interface PaginationFooterProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationFooter({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
}: PaginationFooterProps) {
  const { t } = useLanguage();

  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t">
      <p className="text-sm text-muted-foreground">
        {t("pagination.showing", { from, to, total })}
      </p>

      {totalPages > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={page <= 1}
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 1) onPageChange(page - 1);
                }}
              />
            </PaginationItem>

            <PaginationItem>
              <PaginationLink href="#" isActive size="default" className="px-4 pointer-events-none">
                {t("pagination.pageOf", { page, totalPages })}
              </PaginationLink>
            </PaginationItem>

            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={page >= totalPages}
                className={
                  page >= totalPages ? "pointer-events-none opacity-50" : ""
                }
                onClick={(e) => {
                  e.preventDefault();
                  if (page < totalPages) onPageChange(page + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
