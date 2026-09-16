'use client';

import type { DashboardSummary } from '@zemp/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { ErrorState } from '@/components/shared/States';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { formatCount, formatPercent } from '@/lib/format';

interface StatusBreakdownCardProps {
  title: string;
  summary: UseQueryResult<DashboardSummary>;
  className?: string;
}

/** Share of the active workload by status, with exact counts beside the bar (Frontend.md §28). */
export function StatusBreakdownCard({ title, summary, className }: StatusBreakdownCardProps) {
  const w = summary.data?.workload;
  const segments = w
    ? [
        { label: 'Completed', value: w.completed, fill: 'bg-success' },
        { label: 'In progress', value: w.inProgress, fill: 'bg-primary' },
        { label: 'Blocked', value: w.blocked, fill: 'bg-blocked' },
        { label: 'To do', value: w.todo, fill: 'bg-border-strong' },
      ]
    : [];

  return (
    <Card className={className}>
      <CardHeader title={title} description="Active workload by status" />
      <div className="px-5 pt-4 pb-5">
        {summary.error ? (
          <ErrorState onRetry={() => summary.refetch()} className="py-6" />
        ) : !w ? (
          <div className="grid gap-4">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-kpi font-semibold tracking-tight text-ink tabular">{formatPercent(w.completionRate, 1)}</p>
              <p className="pb-1 text-meta text-ink-muted">
                {formatCount(w.completed)} of {formatCount(w.total)} tasks completed
              </p>
            </div>
            <div
              role="img"
              aria-label={`Status breakdown: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}
              className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full"
            >
              {w.total === 0 ? (
                <div className="h-full w-full bg-track" />
              ) : (
                segments
                  .filter((s) => s.value > 0)
                  .map((s) => <div key={s.label} className={cn('h-full', s.fill)} style={{ width: `${(s.value / w.total) * 100}%` }} />)
              )}
            </div>
            <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3">
              {segments.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 text-ink-secondary">
                    <span className={cn('size-2.5 rounded-full', s.fill)} aria-hidden />
                    {s.label}
                  </span>
                  <span className="font-semibold text-ink tabular">{formatCount(s.value)}</span>
                </li>
              ))}
              <li className="col-span-2 flex items-center justify-between gap-2 border-t border-border-subtle pt-3 text-sm">
                <span className="text-ink-secondary">Overdue (open, past due)</span>
                <span className={cn('font-semibold tabular', w.overdue ? 'text-danger-ink' : 'text-ink')}>{formatCount(w.overdue)}</span>
              </li>
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
