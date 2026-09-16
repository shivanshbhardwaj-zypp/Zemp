'use client';

import { ROLE_LABELS, type TeamMemberItem } from '@zemp/shared';
import { ListChecks, Pencil, SearchX, ShieldCheck, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DelegateAction } from '@/components/people/DelegateAction';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { KpiCard, KpiGrid } from '@/components/shared/KpiCard';
import { Breadcrumbs } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { UserAvatar } from '@/components/ui/Avatar';
import { ActiveBadge, Badge, RiskBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar, toneForRisk } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTeam, useTeamMembers } from '@/hooks/useTeams';
import { ApiError } from '@/lib/api/client';
import { formatCount, formatDate, plural } from '@/lib/format';
import { useTimeZone, useUser } from '@/lib/session';
import { AddMemberDialog, TeamFormDialog } from './TeamDialogs';

/** Team page: scope, KPIs and members with their workload (Frontend.md §87, §175). */
export function TeamDetail({ id }: { id: string }) {
  const user = useUser();
  const timeZone = useTimeZone();
  const team = useTeam(id);
  const members = useTeamMembers(id);
  const [dialog, setDialog] = useState<'edit' | 'add' | null>(null);

  if (team.error) {
    const unavailable = team.error instanceof ApiError && [403, 404].includes(team.error.status);
    return unavailable ? (
      <EmptyState
        icon={SearchX}
        title="This team isn't available"
        description="It may not exist, or it isn't one of the teams you manage."
        action={
          <Button asChild variant="secondary">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
        className="min-h-[60dvh]"
      />
    ) : (
      <ErrorState onRetry={() => team.refetch()} className="min-h-[60dvh]" />
    );
  }
  if (!team.data) return <Skeleton className="h-96 w-full rounded-lg" />;

  const t = team.data;
  const w = t.workload;

  const columns: Column<TeamMemberItem>[] = [
    {
      key: 'name',
      header: 'Employee',
      cell: (m) => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={m.name} size="sm" />
          <div className="min-w-0">
            <span className="flex items-center gap-2">
              <Link href={`/employees/${m.id}`} className="truncate font-medium text-ink hover:underline">
                {m.name}
              </Link>
              {m.role === 'SUB_ADMIN' && (
                <Badge tone="primary" icon={ShieldCheck}>
                  {ROLE_LABELS.SUB_ADMIN}
                </Badge>
              )}
            </span>
            <p className="truncate text-meta text-ink-muted">{m.employeeCode}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', cell: (m) => <span className="text-ink-secondary">{m.jobTitle ?? '—'}</span> },
    {
      key: 'tasks',
      header: 'Tasks',
      align: 'right',
      cell: (m) => (
        <span className="text-ink-secondary tabular">
          {formatCount(m.workload.remaining)} open / {formatCount(m.workload.total)}
        </span>
      ),
    },
    {
      key: 'overdue',
      header: 'Overdue',
      align: 'right',
      cell: (m) => <span className={m.workload.overdue ? 'font-semibold text-danger-ink tabular' : 'text-ink-secondary tabular'}>{formatCount(m.workload.overdue)}</span>,
    },
    {
      key: 'progress',
      header: 'Progress',
      className: 'w-44',
      cell: (m) => <ProgressBar value={m.workload.completionRate} label={`${m.name} progress`} tone={toneForRisk(m.risk)} />,
    },
    { key: 'risk', header: 'Workload', cell: (m) => <RiskBadge risk={m.risk} /> },
    { key: 'status', header: 'Status', cell: (m) => <ActiveBadge active={m.isActive} /> },
    { key: 'joined', header: 'In team since', cell: (m) => <span className="text-ink-muted tabular">{formatDate(m.joinedAt, timeZone)}</span> },
    {
      key: 'delegate',
      header: 'Sub Admin',
      cell: (m) =>
        m.canDelegate ? <DelegateAction person={{ ...m, teamName: t.name }} /> : <span className="text-ink-faint">—</span>,
    },
  ];

  return (
    <>
      <Breadcrumbs items={[{ label: user.role === 'SUPER_ADMIN' ? 'Teams' : 'My Team', href: user.role === 'SUPER_ADMIN' ? '/teams' : undefined }, { label: t.name }]} className="mb-4" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Team: {t.name}</h1>
            {!t.isActive && <Badge tone="neutral">Inactive</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            <span className="font-medium text-ink-secondary">{t.owner ? `Admin: ${t.owner.name}` : 'No admin yet'}</span> · {plural(t.memberCount, 'employee')}
            {t.description ? ` · ${t.description}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={`/tasks?teamId=${t.id}`}>
              <ListChecks />
              Team tasks
            </Link>
          </Button>
          {t.permissions.canManageMembers && (
            <Button variant="secondary" onClick={() => setDialog('add')}>
              <UserPlus />
              Add member
            </Button>
          )}
          {t.permissions.canEdit && (
            <Button onClick={() => setDialog('edit')}>
              <Pencil />
              Edit Team
            </Button>
          )}
        </div>
      </div>

      <KpiGrid className="mb-6 xl:grid-cols-4">
        <KpiCard label="Members" value={formatCount(t.memberCount)} footnote="Active accounts" />
        <KpiCard label="Active Tasks" value={formatCount(w.todo + w.inProgress + w.blocked)} footnote={`${formatCount(w.blocked)} blocked`} />
        <KpiCard label="Completed" value={formatCount(w.completed)} footnote={`of ${plural(w.total, 'task')} in the active workload`} />
        <KpiCard
          label="Members at risk"
          value={formatCount(t.atRiskMembers)}
          emphasis={t.atRiskMembers ? 'warning' : undefined}
          footnote={`${formatCount(w.overdue)} overdue tasks`}
          info="Members whose remaining work cannot be finished by its deadlines at their current pace, or who have overdue work."
        />
      </KpiGrid>

      <Card className="mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <p className="text-sm font-semibold text-ink sm:w-40">Team completion</p>
        <ProgressBar value={w.completionRate} digits={1} label="Team completion" tone={toneForRisk(t.risk)} className="flex-1" />
        <RiskBadge risk={t.risk} />
      </Card>

      <h2 className="mb-3 text-base font-semibold text-ink">Members</h2>
      <DataTable
        caption={`Members of ${t.name}`}
        columns={columns}
        rows={members.data}
        getRowId={(m) => m.id}
        loading={members.isPending}
        error={members.error}
        onRetry={() => members.refetch()}
        minWidth="min-w-[980px]"
        empty={
          <EmptyState
            icon={Users}
            title="No members yet"
            description={t.permissions.canManageMembers ? 'Move employees into this team to start assigning work.' : undefined}
          />
        }
      />

      {dialog === 'edit' && <TeamFormDialog team={t} onClose={() => setDialog(null)} />}
      {dialog === 'add' && <AddMemberDialog team={t} memberIds={members.data?.map((m) => m.id) ?? []} onClose={() => setDialog(null)} />}
    </>
  );
}
