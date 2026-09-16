'use client';

import type { PageMeta } from '@zemp/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { formatCount } from '@/lib/format';

interface PaginationProps {
  meta: PageMeta;
  noun: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

/** "1–20 of 124 tasks" with previous/next; server-side pagination stays authoritative (Frontend.md §79). */
export function Pagination({ meta, noun, onPageChange, onPageSizeChange }: PaginationProps) {
  const sizeId = useId();
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-3"
    >
      <p className="text-meta text-ink-muted tabular">
        {formatCount(from)}–{formatCount(to)} of {formatCount(meta.total)} {noun}
      </p>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <>
            <label htmlFor={sizeId} className="sr-only">
              Rows per page
            </label>
            <Select
              id={sizeId}
              value={meta.pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="hidden w-24 sm:block [&_select]:h-9"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </Select>
          </>
        )}
        <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>
          <ChevronLeft />
          <span className="max-sm:sr-only">Previous</span>
        </Button>
        <span className="text-meta text-ink-muted tabular sm:hidden">
          {meta.page} / {meta.totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          <span className="max-sm:sr-only">Next</span>
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
