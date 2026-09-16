'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDashboardAttention, useDashboardSummary } from '@/hooks/useDashboard';
import { useDailyReport } from '@/hooks/useReports';
import { formatDate, plural } from '@/lib/format';
import { useCan, useTimeZone, useUser } from '@/lib/session';
import { AdminChangesCard, RecentActivityCard } from './ActivityCards';
import { AttentionCard } from './AttentionCard';
import { DashboardKpis } from './DashboardKpis';
import { MyTasksCard } from './MyTasksCard';
import { ProgressListCard } from './ProgressListCard';
import { StatusBreakdownCard } from './StatusBreakdownCard';
import { TeamActivityTable } from './TeamActivityTable';
import { WatchlistCard } from './WatchlistCard';

const TITLES = { SUPER_ADMIN: 'Dashboard', ADMIN: 'My Team Dashboard', EMPLOYEE: 'My Work' } as const;

/**
 * One dashboard, three scopes (Frontend.md §198–199). On small screens the order follows §135:
 * KPIs, urgent work, today's progress, primary lists, then secondary analytics.
 */
export function Dashboard() {
  const user = useUser();
  const timeZone = useTimeZone();
  const can = useCan();
  const summary = useDashboardSummary();
  const attention = useDashboardAttention();
  const isEmployee = user.role === 'EMPLOYEE';
  const report = useDailyReport({}, { enabled: !isEmployee });

  const scope = summary.data?.scope;
  const description = scope ? (
    <span>
      <span className="font-medium text-ink-secondary">{scope.label}</span> · {scope.detail} · Today, {formatDate(new Date(), timeZone)}
    </span>
  ) : (
    <Skeleton className="h-5 w-72" />
  );

  return (
    <>
      <PageHeader
        title={TITLES[user.role]}
        description={description}
        actions={
          can('tasks.create') && (
            <Button asChild>
              <Link href="/tasks?assign=1">
                <Plus />
                Assign Task
              </Link>
            </Button>
          )
        }
      />
      <DashboardKpis role={user.role} summary={summary.data} loading={summary.isPending} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {isEmployee ? (
          <>
            <TodayProgressCard summary={summary} className="order-2 lg:order-none lg:col-span-12" />
            <AttentionCard
              title="Needs attention"
              attention={attention}
              summary={summary.data}
              showAssignee={false}
              className="order-1 lg:order-none lg:col-span-7"
            />
            <RecentActivityCard title="My recent activity" className="order-4 lg:order-none lg:col-span-5" />
            <MyTasksCard className="order-3 lg:order-none lg:col-span-12" />
          </>
        ) : (
          <>
            <StatusBreakdownCard
              title={user.role === 'ADMIN' ? 'Team Completion' : 'Task Progress'}
              summary={summary}
              className="order-2 lg:order-none lg:col-span-5"
            />
            {user.role === 'SUPER_ADMIN' ? (
              <ProgressListCard
                title="Team Progress"
                description="Completion of each team's active workload"
                report={report}
                kind="teams"
                className="order-3 lg:order-none lg:col-span-7"
              />
            ) : (
              <ProgressListCard
                title="Employee Progress"
                description="Completion of each team member's active workload"
                report={report}
                kind="people"
                className="order-3 lg:order-none lg:col-span-7"
              />
            )}
            <AttentionCard
              title="Tasks requiring attention"
              attention={attention}
              summary={summary.data}
              className="order-1 lg:order-none lg:col-span-7"
            />
            <WatchlistCard attention={attention} className="order-4 lg:order-none lg:col-span-5" />
            {user.role === 'SUPER_ADMIN' ? (
              <>
                <TeamActivityTable report={report} className="order-5 lg:order-none lg:col-span-8" />
                <AdminChangesCard className="order-6 lg:order-none lg:col-span-4" />
              </>
            ) : (
              <RecentActivityCard title="Recent team activity" className="order-5 lg:order-none lg:col-span-12" />
            )}
          </>
        )}
      </div>
    </>
  );
}

function TodayProgressCard({ summary, className }: { summary: ReturnType<typeof useDashboardSummary>; className?: string }) {
  const data = summary.data;
  return (
    <Card className={className}>
      <CardHeader title="Today's Progress" description="Your active workload" />
      <div className="px-5 pt-4 pb-5">
        {data ? (
          <>
            <ProgressBar value={data.workload.completionRate} digits={1} label="My progress" className="[&>span]:w-16 [&>span]:text-base" />
            <p className="mt-3 text-sm text-ink-muted">
              {data.workload.completed} of {plural(data.workload.total, 'task')} complete · {data.completedToday} completed
              today · {data.workload.dueToday} due later today
            </p>
          </>
        ) : (
          <Skeleton className="h-10 w-full" />
        )}
      </div>
    </Card>
  );
}
