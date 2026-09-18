'use client';

import { IndianRupee } from 'lucide-react';
import Link from 'next/link';
import { KpiCard, KpiGrid } from '@/components/shared/KpiCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { AccessDenied, EmptyState, ErrorState } from '@/components/shared/States';
import { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useIncentiveOverview } from '@/hooks/useTasks';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { useTimeZone, useUser } from '@/lib/session';

const rupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

/** Every task a manager marked incentivized when assigning or editing it — what's earned vs. still open. */
export function IncentivesPage() {
  const user = useUser();
  const timeZone = useTimeZone();
  const overview = useIncentiveOverview();

  if (user.role !== 'EMPLOYEE') return <AccessDenied />;
  if (overview.error) return <ErrorState onRetry={() => overview.refetch()} className="min-h-[60dvh]" />;
  if (!overview.data) return <Skeleton className="h-96 w-full rounded-lg" />;

  const { tasks, totalEarned, totalPending } = overview.data;

  return (
    <>
      <PageHeader title="Incentives" description="Bonus pay for tasks your manager marked as incentivized." />

      <KpiGrid className="mb-6 sm:grid-cols-2 lg:grid-cols-2">
        <KpiCard label="Earned" value={rupees(totalEarned)} footnote="From completed incentivized tasks" />
        <KpiCard label="Pending" value={rupees(totalPending)} footnote="From open incentivized tasks — not yet earned" />
      </KpiGrid>

      {tasks.length === 0 ? (
        <EmptyState
          icon={IndianRupee}
          title="No incentivized tasks yet"
          description="When a task you're assigned is marked incentivized, it'll show up here."
        />
      ) : (
        <Card className="divide-y divide-border-subtle">
          {tasks.map((t) => (
            <Link
              key={t.taskId}
              href={`/tasks/${t.taskId}`}
              className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface-muted"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{t.title}</p>
                <p className="text-meta text-ink-muted">
                  {t.completedAt ? `Completed ${formatDate(t.completedAt, timeZone)}` : `Due ${formatDate(t.dueAt, timeZone)}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <StatusBadge status={t.status} />
                <span className={cn('font-semibold tabular', t.status === 'COMPLETED' ? 'text-success-ink' : 'text-ink-muted')}>
                  {rupees(t.amount)}
                </span>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
