'use client';

import type { DashboardSummary, SystemRole } from '@zemp/shared';
import { KpiCard, KpiGrid } from '@/components/shared/KpiCard';
import { formatCount, formatPercent, plural } from '@/lib/format';

const ACTIVE_WORKLOAD =
  'Active workload: open tasks plus tasks still inside their deadline or completed today. Calculated by the server.';

/** Role-specific KPI selection from Frontend.md §126 — never every metric at once. */
export function DashboardKpis({ role, summary, loading }: { role: SystemRole; summary?: DashboardSummary; loading: boolean }) {
  const w = summary?.workload;
  const open = w ? w.todo + w.inProgress + w.blocked : 0;
  const people = summary?.people;
  const common = { loading };

  if (role === 'EMPLOYEE') {
    return (
      <KpiGrid className="2xl:grid-cols-5">
        <KpiCard {...common} label="My Tasks" value={formatCount(w?.total ?? 0)} footnote={`${formatCount(w?.remaining ?? 0)} remaining`} info={ACTIVE_WORKLOAD} />
        <KpiCard {...common} label="Completed" value={formatCount(w?.completed ?? 0)} footnote={`${formatCount(summary?.completedToday ?? 0)} completed today`} />
        <KpiCard {...common} label="In Progress" value={formatCount(w?.inProgress ?? 0)} footnote={`${formatCount(w?.todo ?? 0)} not started`} />
        <KpiCard {...common} label="Overdue" value={formatCount(w?.overdue ?? 0)} emphasis={w?.overdue ? 'danger' : undefined} footnote={`${formatCount(w?.dueToday ?? 0)} due later today`} />
        <KpiCard {...common} label="My Progress" value={formatPercent(w?.completionRate ?? 0, 1)} footnote={`${formatCount(w?.completed ?? 0)} of ${plural(w?.total ?? 0, 'task')}`} info={ACTIVE_WORKLOAD} />
      </KpiGrid>
    );
  }

  const isAdmin = role === 'ADMIN';
  return (
    <KpiGrid className="2xl:grid-cols-6">
      {isAdmin ? (
        <>
          <KpiCard {...common} label="Team Members" value={formatCount(people?.total ?? 0)} footnote={`${formatCount(people?.active ?? 0)} active`} />
          <KpiCard {...common} label="Assigned Tasks" value={formatCount(w?.total ?? 0)} footnote={`${formatCount(w?.remaining ?? 0)} remaining`} info={ACTIVE_WORKLOAD} />
        </>
      ) : (
        <>
          <KpiCard {...common} label="Total Employees" value={formatCount(people?.total ?? 0)} footnote="Excludes admins" />
          <KpiCard {...common} label="Active Employees" value={formatCount(people?.active ?? 0)} footnote={`${formatCount((people?.total ?? 0) - (people?.active ?? 0))} inactive`} />
        </>
      )}
      {isAdmin ? (
        <KpiCard {...common} label="In Progress" value={formatCount(w?.inProgress ?? 0)} footnote={`${formatCount(w?.blocked ?? 0)} blocked`} />
      ) : (
        <KpiCard {...common} label="Active Tasks" value={formatCount(open)} footnote={`${formatCount(w?.blocked ?? 0)} blocked`} />
      )}
      <KpiCard {...common} label="Completed Today" value={formatCount(summary?.completedToday ?? 0)} footnote={`${formatCount(summary?.assignedToday ?? 0)} assigned today`} />
      <KpiCard {...common} label="Overdue" value={formatCount(w?.overdue ?? 0)} emphasis={w?.overdue ? 'danger' : undefined} footnote={`${formatCount(w?.dueToday ?? 0)} due later today`} />
      <KpiCard
        {...common}
        label={isAdmin ? 'Team Progress' : 'Overall Progress'}
        value={formatPercent(w?.completionRate ?? 0, 1)}
        footnote={`${formatCount(w?.completed ?? 0)} of ${plural(w?.total ?? 0, 'task')}`}
        info={ACTIVE_WORKLOAD}
      />
    </KpiGrid>
  );
}
