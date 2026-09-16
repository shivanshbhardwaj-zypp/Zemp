'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { ErrorState } from './States';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Server-side sort field; makes the header a sort button. */
  sortKey?: string;
  align?: 'left' | 'right';
  className?: string;
}

export interface SortState {
  key: string;
  order: 'asc' | 'desc';
}

interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[] | undefined;
  getRowId: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty: React.ReactNode;
  sort?: SortState;
  onSortChange?: (key: string) => void;
  onRowClick?: (row: T) => void;
  selection?: { selected: ReadonlySet<string>; onToggle: (id: string) => void; onToggleAll: (ids: string[]) => void };
  minWidth?: string;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Analytics-style table: thin row dividers, sticky header, horizontal scroll inside its own
 * container on narrow screens (Frontend.md §32–33, §80, §189–190).
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  loading,
  error,
  onRetry,
  empty,
  sort,
  onSortChange,
  onRowClick,
  selection,
  minWidth = 'min-w-[760px]',
  footer,
  className,
}: DataTableProps<T>) {
  const colSpan = columns.length + (selection ? 1 : 0);
  const ids = rows?.map(getRowId) ?? [];
  const allSelected = !!selection && ids.length > 0 && ids.every((id) => selection.selected.has(id));

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-card', className)}>
      <div className="overflow-x-auto">
        <table className={cn('w-full border-collapse text-sm', minWidth)}>
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border-subtle">
              {selection && (
                <th scope="col" className="w-12 px-5 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    checked={allSelected}
                    onChange={() => selection.onToggleAll(ids)}
                    className="size-4 accent-primary-strong"
                  />
                </th>
              )}
              {columns.map((column) => {
                const order = sort && column.sortKey && sort.key === column.sortKey ? sort.order : null;
                const active = order !== null;
                const SortIcon = order === null ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={order === null ? undefined : order === 'asc' ? 'ascending' : 'descending'}
                    className={cn(
                      'px-4 py-3 text-meta font-semibold whitespace-nowrap text-ink-secondary first:pl-5 last:pr-5',
                      column.align === 'right' ? 'text-right' : 'text-left',
                      column.className,
                    )}
                  >
                    {column.sortKey && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(column.sortKey!)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-xs transition-colors hover:text-ink',
                          active && 'text-ink',
                        )}
                      >
                        {column.header}
                        <SortIcon className={cn('size-3.5', !active && 'text-ink-faint')} aria-hidden />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i} className="border-b border-border-subtle last:border-0">
                  <td colSpan={colSpan} className="px-5 py-4">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={colSpan}>
                  <ErrorState onRetry={onRetry} />
                </td>
              </tr>
            ) : !rows?.length ? (
              <tr>
                <td colSpan={colSpan}>{empty}</td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = getRowId(row);
                const selected = selection?.selected.has(id);
                return (
                  <tr
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'h-14 border-b border-border-subtle transition-colors duration-150 last:border-0',
                      selected ? 'bg-primary-selected' : 'hover:bg-surface-row',
                      onRowClick && 'cursor-pointer',
                    )}
                  >
                    {selection && (
                      <td className="w-12 px-5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={selected}
                          onChange={() => selection.onToggle(id)}
                          className="size-4 accent-primary-strong"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          'px-4 py-2 align-middle first:pl-5 last:pr-5',
                          column.align === 'right' && 'text-right',
                          column.className,
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
