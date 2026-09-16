'use client';

import { ROLE_LABELS } from '@zemp/shared';
import { KeyRound, ListChecks, Pencil, SearchX, UserRoundCheck, UserRoundX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { RecentActivityCard } from '@/components/dashboard/ActivityCards';
import { TaskRow } from '@/components/tasks/TaskRow';
import { KpiCard, KpiGrid } from '@/components/shared/KpiCard';
import { Breadcrumbs } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { UserAvatar } from '@/components/ui/Avatar';
import { ActiveBadge, RiskBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ProgressBar, toneForRisk } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useEmployee } from '@/hooks/usePeople';
import { useTasks } from '@/hooks/useTasks';
import { ApiError } from '@/lib/api/client';
import { formatCount, formatDateTime, formatPercent, formatRelative } from '@/lib/format';
import { useTimeZone, useUser } from '@/lib/session';
import { AccountStatusDialog, PasswordResetDialog } from './AccountActions';
import { DelegateAction } from './DelegateAction';
import { EmployeeFormDialog } from './PersonForms';

/** Employee profile: identity, workload overview, current tasks, recent activity (Frontend.md §41). */
export function EmployeeProfile({ id }: { id: string }) {
  const viewer = useUser();
  const timeZone = useTimeZone();
  const employee = useEmployee(id);
  const tasks = useTasks({ assigneeId: id, status: ['TODO', 'IN_PROGRESS', 'BLOCKED'], sort: 'dueAt', order: 'asc', page: 1, pageSize: 8 });
  const [dialog, setDialog] = useState<'edit' | 'status' | 'reset' | null>(null);

  if (employee.error) {
    const unavailable = employee.error instanceof ApiError && [403, 404].includes(employee.error.status);
    return unavailable ? (
      <EmptyState
        icon={SearchX}
        title="This person isn't available"
        description="They may be outside the teams you can see."
        action={
          <Button asChild variant="secondary">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
        className="min-h-[60dvh]"
      />
    ) : (
      <ErrorState onRetry={() => employee.refetch()} className="min-h-[60dvh]" />
    );
  }
  if (!employee.data) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-34 w-full rounded-lg" />
      </div>
    );
  }

  const e = employee.data;
  const w = e.workload;
  const listHref = viewer.role === 'SUPER_ADMIN' ? '/employees' : '/teams';

  return (
    <>
      <Breadcrumbs items={[{ label: viewer.role === 'SUPER_ADMIN' ? 'Employees' : 'My Team', href: listHref }, { label: e.name }]} className="mb-4" />

      <Card className="mb-6 flex flex-col gap-5 p-6 md:flex-row md:items-center">
        <UserAvatar name={e.name} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{e.name}</h1>
            <ActiveBadge active={e.isActive} />
          </div>
          <p className="mt-1 text-sm text-ink-secondary">
            {[e.jobTitle, e.team?.name, e.employeeCode].filter(Boolean).join(' • ')}
          </p>
          <p className="mt-1 text-meta text-ink-muted">
            {ROLE_LABELS[e.role]} · {e.email}
            {e.manager ? ` · Reports to ${e.manager.name}` : ''}
            {e.lastLoginAt ? ` · Last signed in ${formatRelative(e.lastLoginAt)}` : ''}
          </p>
          {e.ownedTeams.length > 0 && <p className="mt-1 text-meta text-ink-muted">Manages {e.ownedTeams.map((t) => t.name).join(', ')}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/tasks?assigneeId=${e.id}`}>
              <ListChecks />
              View tasks
            </Link>
          </Button>
          {e.permissions.canDelegate && (
            <DelegateAction person={{ id: e.id, name: e.name, role: e.role, teamName: e.team?.name }} size="md" />
          )}
          {e.permissions.canEdit && e.role === 'EMPLOYEE' && (
            <Button variant="secondary" size="sm" onClick={() => setDialog('edit')}>
              <Pencil />
              Edit
            </Button>
          )}
          {e.permissions.canResetPassword && (
            <Button variant="secondary" size="sm" onClick={() => setDialog('reset')}>
              <KeyRound />
              Reset access
            </Button>
          )}
          {e.permissions.canChangeStatus && (
            <Button variant={e.isActive ? 'ghost' : 'secondary'} size="sm" onClick={() => setDialog('status')}>
              {e.isActive ? <UserRoundX /> : <UserRoundCheck />}
              {e.isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          )}
        </div>
      </Card>

      <KpiGrid className="mb-6 xl:grid-cols-4">
        <KpiCard label="Assigned" value={formatCount(w.total)} footnote="Active workload" />
        <KpiCard label="Completed" value={formatCount(w.completed)} footnote={`${formatCount(e.completedToday)} today`} />
        <KpiCard label="In Progress" value={formatCount(w.inProgress)} footnote={`${formatCount(w.blocked)} blocked · ${formatCount(w.todo)} to do`} />
        <KpiCard label="Overdue" value={formatCount(w.overdue)} emphasis={w.overdue ? 'danger' : undefined} footnote={`${formatCount(w.dueToday)} due later today`} />
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader
            title="Current Tasks"
            description="Open work, soonest deadline first"
            action={
              <Link href={`/tasks?assigneeId=${e.id}`} className="text-meta font-medium text-primary-ink hover:underline">
                View all
              </Link>
            }
          />
          <div className="px-5 pt-3 pb-4">
            <div className="mb-3 flex items-center gap-4">
              <ProgressBar value={w.completionRate} digits={1} label={`${e.name} completion`} tone={toneForRisk(e.risk)} className="flex-1" />
              <RiskBadge risk={e.risk} />
            </div>
            {tasks.error ? (
              <ErrorState onRetry={() => tasks.refetch()} className="py-6" />
            ) : !tasks.data ? (
              <Skeleton className="h-32 w-full" />
            ) : tasks.data.items.length === 0 ? (
              <EmptyState icon={ListChecks} title="No open tasks" className="py-6" />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {tasks.data.items.map((task) => (
                  <TaskRow key={task.id} task={task} showAssignee={false} />
                ))}
              </ul>
            )}
          </div>
        </Card>
        <RecentActivityCard title="Recent Activity" className="lg:col-span-5" employeeId={e.id} />
      </div>

      <p className="mt-6 text-meta text-ink-muted">
        Account created {formatDateTime(e.createdAt, timeZone)} · Completion {formatPercent(w.completionRate, 1)} of the active workload
      </p>

      {dialog === 'edit' && <EmployeeFormDialog employee={e} onClose={() => setDialog(null)} />}
      {dialog === 'status' && <AccountStatusDialog account={e} onClose={() => setDialog(null)} />}
      {dialog === 'reset' && <PasswordResetDialog account={e} onClose={() => setDialog(null)} />}
    </>
  );
}
