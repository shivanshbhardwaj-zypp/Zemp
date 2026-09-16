'use client';

import { addDays, daysBetween, MAX_PROGRESS_RANGE_DAYS } from '@zemp/shared';
import { TrendingUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useProgressReport } from '@/hooks/useReports';
import { useUrlParams } from '@/hooks/useUrlParams';
import { cn } from '@/lib/cn';
import { formatCount, formatDayKey, formatPercent } from '@/lib/format';

const CompletionChart = dynamic(() => import('@/components/charts/CompletionChart'), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full" />,
});

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Day-by-day cumulative completion: the 5-day view from Frontend.md §45, plus custom ranges. */
export function ProgressReportView({ today, scope }: { today: string; scope: { teamId?: string; adminId?: string; employeeId?: string } }) {
  const [params, setParams] = useUrlParams();
  const range = params.get('range') ?? '5';
  const customFrom = params.get('from');
  const customTo = params.get('to');
  const validCustom =
    range === 'custom' &&
    customFrom &&
    customTo &&
    DATE_KEY.test(customFrom) &&
    DATE_KEY.test(customTo) &&
    customFrom <= customTo &&
    daysBetween(customFrom, customTo) < MAX_PROGRESS_RANGE_DAYS;
  const days = range === '7' ? 7 : 5;
  const from = validCustom ? customFrom : addDays(today, -(days - 1));
  const to = validCustom ? customTo : today;

  const report = useProgressReport({ from, to, ...scope });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select
          aria-label="Period"
          value={range}
          onChange={(e) => setParams({ range: e.target.value === '5' ? null : e.target.value, from: e.target.value === 'custom' ? addDays(today, -13) : null, to: e.target.value === 'custom' ? today : null })}
          className="w-44 [&_select]:h-9"
        >
          <option value="5">Last 5 days</option>
          <option value="7">Last 7 days</option>
          <option value="custom">Custom range</option>
        </Select>
        {range === 'custom' && (
          <>
            <Input type="date" aria-label="From" value={customFrom ?? ''} max={customTo ?? today} onChange={(e) => setParams({ from: e.target.value })} className="h-9 w-44" />
            <span className="text-sm text-ink-muted">to</span>
            <Input type="date" aria-label="To" value={customTo ?? ''} min={customFrom ?? undefined} max={today} onChange={(e) => setParams({ to: e.target.value })} className="h-9 w-44" />
            {!validCustom && <p className="text-meta text-danger-ink">Choose a range of {MAX_PROGRESS_RANGE_DAYS} days or fewer.</p>}
          </>
        )}
      </div>

      {report.error ? (
        <ErrorState description="We couldn't load progress for this period." onRetry={() => report.refetch()} />
      ) : !report.data ? (
        <div className="grid gap-6">
          <Skeleton className="h-72 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader
              title="Completion over time"
              description={`${report.data.scope.label} · completed share of the active workload at the end of each day`}
            />
            <div className="px-5 pt-3 pb-5">
              <CompletionChart data={report.data.totals} />
            </div>
          </Card>

          {report.data.rows.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No progress recorded in this period" />
          ) : (
            <Card className="overflow-hidden">
              <CardHeader title="Day-by-day progress" description="Completed / total tasks at the end of each day" />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <caption className="sr-only">Completed and total tasks per person per day</caption>
                  <thead>
                    <tr className="border-y border-border-subtle bg-surface-subtle">
                      <th scope="col" className="px-5 py-3 text-left text-meta font-semibold text-ink-secondary">
                        Employee
                      </th>
                      {report.data.days.map((day, i) => (
                        <th key={day} scope="col" className="px-3 py-3 text-right text-meta font-semibold whitespace-nowrap text-ink-secondary">
                          <span className="block">Day {i + 1}</span>
                          <span className="block font-normal text-ink-muted">{formatDayKey(day, { month: 'short', day: 'numeric' })}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.data.rows.map((row) => (
                      <tr key={row.user.id} className="border-b border-border-subtle last:border-0 hover:bg-surface-row">
                        <th scope="row" className="px-5 py-3 text-left font-medium">
                          <Link href={`/employees/${row.user.id}`} className="text-ink hover:underline">
                            {row.user.name}
                          </Link>
                          <span className="block text-meta font-normal text-ink-muted">{row.team?.name ?? 'No team'}</span>
                        </th>
                        {row.points.map((point) => (
                          <td key={point.date} className="px-3 py-3 text-right align-top">
                            <span className="block text-ink tabular">
                              {formatCount(point.completed)}
                              <span className="text-ink-muted">/{formatCount(point.total)}</span>
                            </span>
                            <span className="mt-1.5 ml-auto block h-1.5 w-16 overflow-hidden rounded-full bg-track" aria-hidden>
                              <span
                                className={cn('block h-full rounded-full', point.completionRate >= 100 ? 'bg-success' : 'bg-primary')}
                                style={{ width: `${Math.min(point.completionRate, 100)}%` }}
                              />
                            </span>
                            <span className="mt-1 block text-xs text-ink-muted tabular">{formatPercent(point.completionRate, 0)}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border-strong bg-surface-subtle">
                      <th scope="row" className="px-5 py-3 text-left font-semibold text-ink">
                        Total
                      </th>
                      {report.data.totals.map((point) => (
                        <td key={point.date} className="px-3 py-3 text-right font-semibold text-ink tabular">
                          {formatCount(point.completed)}/{formatCount(point.total)}
                          <span className="block text-xs font-normal text-ink-muted">{formatPercent(point.completionRate, 1)}</span>
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
