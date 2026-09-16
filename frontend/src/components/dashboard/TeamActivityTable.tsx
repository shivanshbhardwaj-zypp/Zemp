'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import type { DailyReport, PersonProgress } from '@zemp/shared';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { EmptyState } from '@/components/shared/States';
import { UserAvatar } from '@/components/ui/Avatar';
import { RiskBadge } from '@/components/ui/Badge';
import { ProgressBar, toneForRisk } from '@/components/ui/ProgressBar';
import { formatCount } from '@/lib/format';

const count = (value: number, danger = false) => (
  <span className={danger && value > 0 ? 'font-semibold text-danger-ink tabular' : 'text-ink-secondary tabular'}>
    {formatCount(value)}
  </span>
);

const columns: Column<PersonProgress>[] = [
  {
    key: 'employee',
    header: 'Employee',
    cell: (p) => (
      <div className="flex items-center gap-3">
        <UserAvatar name={p.user.name} size="sm" />
        <div className="min-w-0">
          <Link href={`/employees/${p.user.id}`} className="block truncate font-medium text-ink hover:underline">
            {p.user.name}
          </Link>
          <p className="truncate text-meta text-ink-muted">{p.team?.name ?? 'No team'}</p>
        </div>
      </div>
    ),
  },
  { key: 'completed', header: 'Done today', align: 'right', cell: (p) => count(p.completedToday) },
  { key: 'inProgress', header: 'In progress', align: 'right', cell: (p) => count(p.workload.inProgress) },
  { key: 'blocked', header: 'Blocked', align: 'right', cell: (p) => count(p.workload.blocked) },
  { key: 'overdue', header: 'Overdue', align: 'right', cell: (p) => count(p.workload.overdue, true) },
  {
    key: 'progress',
    header: 'Progress',
    className: 'w-44',
    cell: (p) => <ProgressBar value={p.workload.completionRate} label={`${p.user.name} progress`} tone={toneForRisk(p.risk)} />,
  },
  { key: 'risk', header: 'Status', cell: (p) => <RiskBadge risk={p.risk} /> },
];

/** "Today's Activity" for the whole organization (Frontend.md §22). */
export function TeamActivityTable({ report, className }: { report: UseQueryResult<DailyReport>; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Today&apos;s Activity</h2>
          <p className="text-meta text-ink-muted">People with the most urgent workload first</p>
        </div>
        <Link href="/reports" className="text-meta font-medium text-primary-ink hover:underline">
          View daily report
        </Link>
      </div>
      <DataTable
        caption="Today's activity by employee"
        columns={columns}
        rows={report.data?.people.slice(0, 10)}
        getRowId={(p) => p.user.id}
        loading={report.isPending}
        error={report.error}
        onRetry={() => report.refetch()}
        empty={<EmptyState icon={Users} title="No people in scope" />}
      />
    </div>
  );
}
