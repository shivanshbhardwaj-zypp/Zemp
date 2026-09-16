'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import type { DailyReport } from '@zemp/shared';
import Link from 'next/link';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { RiskBadge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { ProgressBar, toneForRisk } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatCount } from '@/lib/format';

interface ProgressListCardProps {
  title: string;
  description: string;
  report: UseQueryResult<DailyReport>;
  kind: 'teams' | 'people';
  limit?: number;
  className?: string;
}

/** "Team A ███████ 82%" rows, most at-risk first (Frontend.md §22–23). */
export function ProgressListCard({ title, description, report, kind, limit = 8, className }: ProgressListCardProps) {
  const rows =
    kind === 'teams'
      ? report.data?.teams.map((t) => ({
          id: t.team.id,
          href: `/teams/${t.team.id}`,
          name: t.team.name,
          detail: `${t.owner?.name ?? 'No admin'} · ${formatCount(t.memberCount)} members`,
          workload: t.workload,
          risk: t.risk,
        }))
      : report.data?.people.map((p) => ({
          id: p.user.id,
          href: `/employees/${p.user.id}`,
          name: p.user.name,
          detail: `${formatCount(p.workload.completed)} of ${formatCount(p.workload.total)} done · ${formatCount(p.workload.overdue)} overdue`,
          workload: p.workload,
          risk: p.risk,
        }));

  return (
    <Card className={className}>
      <CardHeader
        title={title}
        description={description}
        action={
          <Link href="/reports" className="text-meta font-medium text-primary-ink hover:underline">
            View report
          </Link>
        }
      />
      <div className="px-5 pt-2 pb-3">
        {report.error ? (
          <ErrorState onRetry={() => report.refetch()} className="py-6" />
        ) : !rows ? (
          <div className="grid gap-4 py-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={kind === 'teams' ? 'No teams yet' : 'No team members yet'} className="py-8" />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {rows.slice(0, limit).map((row) => (
              <li key={row.id} className="grid grid-cols-1 items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(110px,170px)_auto]">
                <div className="min-w-0">
                  <Link href={row.href} className="block truncate text-sm font-medium text-ink hover:underline">
                    {row.name}
                  </Link>
                  <p className="truncate text-meta text-ink-muted">{row.detail}</p>
                </div>
                <ProgressBar value={row.workload.completionRate} label={`${row.name} progress`} tone={toneForRisk(row.risk)} />
                <RiskBadge risk={row.risk} className="justify-self-start sm:justify-self-end" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
