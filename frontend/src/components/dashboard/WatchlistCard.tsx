'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import type { DashboardAttention } from '@zemp/shared';
import { ShieldCheck, UserX } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { RiskBadge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatCount, plural } from '@/lib/format';
import { useUser } from '@/lib/session';

/** Teams and people whose workload is at risk, plus inactive accounts (Frontend.md §138–139). */
export function WatchlistCard({ attention, className }: { attention: UseQueryResult<DashboardAttention>; className?: string }) {
  const user = useUser();
  const data = attention.data;
  const rows = [
    ...(data?.atRiskTeams ?? []).map((t) => ({
      id: t.team.id,
      href: `/teams/${t.team.id}`,
      name: t.team.name,
      detail: `Team · ${formatCount(t.workload.overdue)} overdue · ${formatCount(t.workload.remaining)} remaining`,
      risk: t.risk,
    })),
    ...(data?.atRiskPeople ?? []).map((p) => ({
      id: p.user.id,
      href: `/employees/${p.user.id}`,
      name: p.user.name,
      detail: `${p.team?.name ?? 'No team'} · ${formatCount(p.workload.overdue)} overdue · ${formatCount(p.workload.remaining)} remaining`,
      risk: p.risk,
    })),
  ];

  return (
    <Card className={className}>
      <CardHeader
        title={user.role === 'SUPER_ADMIN' ? 'Watchlist' : 'Members at risk'}
        description="Workload behind its deadlines — an operational signal, not a judgement"
      />
      <div className="px-5 pt-2 pb-4">
        {attention.error ? (
          <ErrorState onRetry={() => attention.refetch()} className="py-6" />
        ) : !data ? (
          <div className="grid gap-3 py-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            {rows.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="Everyone is on track" className="py-8" />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={row.href} className="block truncate text-sm font-medium text-ink hover:underline">
                        {row.name}
                      </Link>
                      <p className="truncate text-meta text-ink-muted">{row.detail}</p>
                    </div>
                    <RiskBadge risk={row.risk} />
                  </li>
                ))}
              </ul>
            )}
            {data.inactivePeople !== null && data.inactivePeople > 0 && (
              <Link
                href="/employees?status=inactive"
                className="mt-2 flex items-center gap-2.5 rounded-md bg-surface-subtle px-3 py-2.5 text-sm text-ink-secondary transition-colors hover:bg-surface-hover"
              >
                <UserX className="size-4 text-ink-faint" aria-hidden />
                {plural(data.inactivePeople, 'inactive account')}
              </Link>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
