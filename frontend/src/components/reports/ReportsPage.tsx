'use client';

import { addDays, dayKey, type PersonProgress } from '@zemp/shared';
import { History, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ProgressListCard } from '@/components/dashboard/ProgressListCard';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { KpiCard, KpiGrid } from '@/components/shared/KpiCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { AccessDenied, EmptyState, ErrorState } from '@/components/shared/States';
import { UserAvatar } from '@/components/ui/Avatar';
import { RiskBadge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ProgressBar, toneForRisk } from '@/components/ui/ProgressBar';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useAdmins, useEmployees } from '@/hooks/usePeople';
import { useDailyReport } from '@/hooks/useReports';
import { useTeamOptions } from '@/hooks/useTeams';
import { useUrlParams } from '@/hooks/useUrlParams';
import { formatCount, formatDayKey, formatPercent } from '@/lib/format';
import { useCan, useTimeZone, useUser } from '@/lib/session';
import { ProgressReportView } from './ProgressReportView';

const TrendChart = dynamic(() => import('@/components/charts/TrendChart'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Daily Report and progress over time (Frontend.md §43–47). Every number comes from the API;
 * past days use stored end-of-day snapshots rather than today's task state.
 */
export function ReportsPage({ variant }: { variant: 'reports' | 'self' }) {
  const user = useUser();
  const can = useCan();
  const timeZone = useTimeZone();
  const [params, setParams] = useUrlParams();
  const today = dayKey(new Date(), timeZone);
  const isEmployee = user.role === 'EMPLOYEE';
  const tab = params.get('tab') === 'progress' ? 'progress' : 'daily';
  const rawDate = params.get('date');
  const date = rawDate && DATE_KEY.test(rawDate) && rawDate <= today ? rawDate : today;
  const scope = {
    teamId: params.get('teamId') ?? undefined,
    adminId: params.get('adminId') ?? undefined,
    employeeId: params.get('employeeId') ?? undefined,
  };

  const report = useDailyReport({ date, ...scope }, { enabled: can('reports.read') });
  const teams = useTeamOptions(!isEmployee);
  const admins = useAdmins({ status: 'active', page: 1, pageSize: 100 }, { enabled: user.role === 'SUPER_ADMIN' });
  const employees = useEmployees({ status: 'active', page: 1, pageSize: 100, teamId: scope.teamId }, { enabled: !isEmployee });

  if (!can('reports.read')) return <AccessDenied />;
  if (variant === 'reports' && isEmployee) return <AccessDenied />;

  const datePreset = date === today ? 'today' : date === addDays(today, -1) ? 'yesterday' : 'custom';
  const data = report.data;
  const s = data?.summary;

  const peopleColumns: Column<PersonProgress>[] = [
    {
      key: 'employee',
      header: 'Employee',
      cell: (p) => (
        <div className="flex min-w-0 items-center gap-3">
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
    { key: 'total', header: 'Total', align: 'right', cell: (p) => <span className="tabular">{formatCount(p.workload.total)}</span> },
    { key: 'done', header: 'Done', align: 'right', cell: (p) => <span className="tabular">{formatCount(p.workload.completed)}</span> },
    { key: 'today', header: 'Done that day', align: 'right', cell: (p) => <span className="tabular">{formatCount(p.completedToday)}</span> },
    { key: 'remaining', header: 'Remaining', align: 'right', cell: (p) => <span className="tabular">{formatCount(p.workload.remaining)}</span> },
    { key: 'blocked', header: 'Blocked', align: 'right', cell: (p) => <span className="tabular">{formatCount(p.workload.blocked)}</span> },
    {
      key: 'overdue',
      header: 'Overdue',
      align: 'right',
      cell: (p) => <span className={p.workload.overdue ? 'font-semibold text-danger-ink tabular' : 'tabular'}>{formatCount(p.workload.overdue)}</span>,
    },
    {
      key: 'progress',
      header: 'Progress',
      className: 'w-48',
      cell: (p) => <ProgressBar value={p.workload.completionRate} digits={1} label={`${p.user.name} progress`} tone={toneForRisk(p.risk)} />,
    },
    { key: 'risk', header: 'Status', cell: (p) => <RiskBadge risk={p.risk} /> },
  ];

  return (
    <>
      <PageHeader
        title={variant === 'self' ? 'My Progress' : 'Reports'}
        description={
          data ? (
            <span>
              <span className="font-medium text-ink-secondary">{data.scope.label}</span> · {data.scope.detail}
            </span>
          ) : (
            'Daily progress and deadline risk'
          )
        }
      />

      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value === 'daily' ? null : value }, { resetPage: false })}>
        <TabsList aria-label="Report views" className="mb-5">
          <TabsTrigger value="daily">Daily report</TabsTrigger>
          <TabsTrigger value="progress">Progress over time</TabsTrigger>
        </TabsList>

        {!isEmployee && (
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Select aria-label="Team" value={scope.teamId ?? ''} onChange={(e) => setParams({ teamId: e.target.value, employeeId: null })} className="sm:w-48 [&_select]:sm:h-9">
              <option value="">{user.role === 'SUPER_ADMIN' ? 'All teams' : 'All my teams'}</option>
              {(teams.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            {user.role === 'SUPER_ADMIN' && (
              <Select aria-label="Admin" value={scope.adminId ?? ''} onChange={(e) => setParams({ adminId: e.target.value, teamId: null, employeeId: null })} className="sm:w-48 [&_select]:sm:h-9">
                <option value="">All admins</option>
                {(admins.data?.items ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
            <Select aria-label="Employee" value={scope.employeeId ?? ''} onChange={(e) => setParams({ employeeId: e.target.value })} className="sm:w-52 [&_select]:sm:h-9">
              <option value="">All employees</option>
              {(employees.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <TabsContent value="daily" className="outline-none">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Select
              aria-label="Report date"
              value={datePreset}
              onChange={(e) => {
                const preset = e.target.value;
                setParams({ date: preset === 'today' ? null : preset === 'yesterday' ? addDays(today, -1) : addDays(today, -2) });
              }}
              className="w-40 [&_select]:h-9"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="custom">Custom date</option>
            </Select>
            {datePreset === 'custom' && (
              <Input
                type="date"
                aria-label="Choose a date"
                value={date}
                max={today}
                onChange={(e) => e.target.value && setParams({ date: e.target.value })}
                className="h-9 w-44"
              />
            )}
            <p className="text-sm text-ink-muted">
              {formatDayKey(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {data && !data.isToday && <span className="ml-2 text-meta">· From the end-of-day snapshot</span>}
            </p>
          </div>

          {report.error ? (
            <ErrorState description="We couldn't load this report." onRetry={() => report.refetch()} />
          ) : (
            <>
              <KpiGrid className="mb-6 2xl:grid-cols-6">
                <KpiCard label="Assigned" value={formatCount(s?.assignedToday ?? 0)} loading={!s} footnote="New tasks that day" />
                <KpiCard label="Completed" value={formatCount(s?.completedToday ?? 0)} loading={!s} footnote="Completions that day" />
                <KpiCard label="In progress" value={formatCount(s?.inProgress ?? 0)} loading={!s} footnote="At the end of the day" />
                <KpiCard label="Blocked" value={formatCount(s?.blocked ?? 0)} loading={!s} footnote="Waiting on something" />
                <KpiCard label="Overdue" value={formatCount(s?.overdue ?? 0)} loading={!s} emphasis={s?.overdue ? 'danger' : undefined} footnote={`${formatCount(s?.atRiskPeople ?? 0)} people at risk`} />
                <KpiCard
                  label="Overall completion"
                  value={formatPercent(s?.completionRate ?? 0, 2)}
                  loading={!s}
                  footnote={`${formatCount(data?.workload.completed ?? 0)} of ${formatCount(data?.workload.total ?? 0)} tasks`}
                  info="Completed tasks as a share of the active workload that day."
                />
              </KpiGrid>

              <div className="mb-6 grid gap-6 lg:grid-cols-12">
                <Card className="lg:col-span-7">
                  <CardHeader title="Progress this week" description={`The seven days ending ${formatDayKey(date, { month: 'short', day: 'numeric' })}`} />
                  <div className="px-5 pt-3 pb-5">{data ? <TrendChart data={data.trend} /> : <Skeleton className="h-64 w-full" />}</div>
                </Card>
                {!isEmployee && data && data.teams.length > 0 ? (
                  <ProgressListCard title="Team comparison" description="Same measures for every team" report={report} kind="teams" className="lg:col-span-5" />
                ) : (
                  <Card className="lg:col-span-5">
                    <CardHeader title="Workload status" description="How the active workload breaks down" />
                    <div className="grid grid-cols-2 gap-4 px-5 pt-4 pb-5 text-sm">
                      {data ? (
                        (
                          [
                            ['To do', data.workload.todo],
                            ['In progress', data.workload.inProgress],
                            ['Blocked', data.workload.blocked],
                            ['Completed', data.workload.completed],
                            ['Overdue', data.workload.overdue],
                            ['Remaining', data.workload.remaining],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label} className="rounded-md bg-surface-subtle px-3.5 py-3">
                            <p className="text-meta text-ink-muted">{label}</p>
                            <p className="mt-0.5 text-xl font-semibold text-ink tabular">{formatCount(value)}</p>
                          </div>
                        ))
                      ) : (
                        <Skeleton className="col-span-2 h-40" />
                      )}
                    </div>
                  </Card>
                )}
              </div>

              {!isEmployee && (
                <>
                  <h2 className="mb-3 text-base font-semibold text-ink">Employee progress</h2>
                  <DataTable
                    caption="Employee progress for the selected day"
                    columns={peopleColumns}
                    rows={data?.people}
                    getRowId={(p) => p.user.id}
                    loading={!data}
                    minWidth="min-w-[1040px]"
                    empty={<EmptyState icon={Users} title="No one in this scope" />}
                  />
                </>
              )}
              {data && data.people.length === 0 && isEmployee && <EmptyState icon={History} title="No work recorded for this day" />}
            </>
          )}
        </TabsContent>

        <TabsContent value="progress" className="outline-none">
          <ProgressReportView today={today} scope={scope} />
        </TabsContent>
      </Tabs>
    </>
  );
}
