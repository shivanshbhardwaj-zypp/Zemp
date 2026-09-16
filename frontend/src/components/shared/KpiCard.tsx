'use client';

import { Info } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/cn';

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  /** Explains how the number is derived; shown on hover and focus. */
  info?: string;
  footnote?: React.ReactNode;
  emphasis?: 'danger' | 'warning';
  loading?: boolean;
  className?: string;
}

/** Title small, metric large, context small (Frontend.md §25–27). */
export function KpiCard({ label, value, info, footnote, emphasis, loading, className }: KpiCardProps) {
  return (
    <Card className={cn('flex min-h-34 flex-col p-5', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-secondary">{label}</p>
        {info && (
          <Tooltip content={info}>
            <button
              type="button"
              aria-label={`About ${label}: ${info}`}
              className="-m-1 flex size-6 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-ink"
            >
              <Info className="size-4" aria-hidden />
            </button>
          </Tooltip>
        )}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-4 h-9 w-20" />
          <Skeleton className="mt-3 h-4 w-28" />
        </>
      ) : (
        <>
          <p
            className={cn(
              'mt-3 text-kpi font-semibold tracking-tight tabular',
              emphasis === 'danger' ? 'text-danger-ink' : emphasis === 'warning' ? 'text-warning-ink' : 'text-ink',
            )}
          >
            {value}
          </p>
          {footnote && <div className="mt-auto pt-2 text-meta text-ink-muted">{footnote}</div>}
        </>
      )}
    </Card>
  );
}

export function KpiGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>;
}
