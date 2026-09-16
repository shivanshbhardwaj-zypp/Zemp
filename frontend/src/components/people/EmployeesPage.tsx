'use client';

import { listPeopleQuerySchema, type EmployeeListItem } from '@zemp/shared';
import {
  EllipsisVertical,
  KeyRound,
  ListChecks,
  Pencil,
  Plus,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { KpiCard, KpiGrid } from '@/components/shared/KpiCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { SearchInput } from '@/components/shared/SearchInput';
import { AccessDenied, EmptyState } from '@/components/shared/States';
import { UserAvatar } from '@/components/ui/Avatar';
import { ActiveBadge, RiskBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { ProgressBar, toneForRisk } from '@/components/ui/ProgressBar';
import { Select } from '@/components/ui/Select';
import { useEmployee, useEmployeeStats, useEmployees } from '@/hooks/usePeople';
import { useTeamOptions } from '@/hooks/useTeams';
import { parseSearchParams, useUrlParams } from '@/hooks/useUrlParams';
import { formatCount } from '@/lib/format';
import { useCan, useUser } from '@/lib/session';
import { AccountStatusDialog, PasswordResetDialog } from './AccountActions';
import { PeopleTabs } from './PeopleTabs';
import { EmployeeFormDialog } from './PersonForms';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; id: string }
  | { kind: 'status'; person: EmployeeListItem }
  | { kind: 'reset'; person: EmployeeListItem };

export function EmployeesPage() {
  const user = useUser();
  const can = useCan();
  const [params, setParams] = useUrlParams();
  const query = useMemo(() => parseSearchParams(listPeopleQuerySchema, params), [params]);
  const allowed = can('users.read');
  const employees = useEmployees(query, { enabled: allowed });
  const stats = useEmployeeStats(allowed);
  const teams = useTeamOptions(allowed);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  if (!allowed) return <AccessDenied />;

  const columns: Column<EmployeeListItem>[] = [
    {
      key: 'name',
      header: 'Employee',
      sortKey: 'name',
      cell: (e) => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={e.name} size="sm" />
          <div className="min-w-0">
            <Link href={`/employees/${e.id}`} className="block truncate font-medium text-ink hover:underline">
              {e.name}
            </Link>
            <p className="truncate text-meta text-ink-muted">{e.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'code', header: 'Employee ID', sortKey: 'employeeCode', cell: (e) => <span className="text-ink-secondary tabular">{e.employeeCode ?? '—'}</span> },
    { key: 'team', header: 'Team', cell: (e) => <span className="text-ink-secondary">{e.team?.name ?? '—'}</span> },
    { key: 'role', header: 'Role', cell: (e) => <span className="text-ink-secondary">{e.jobTitle ?? '—'}</span> },
    { key: 'manager', header: 'Admin', cell: (e) => <span className="text-ink-secondary">{e.manager?.name ?? '—'}</span> },
    { key: 'status', header: 'Status', cell: (e) => <ActiveBadge active={e.isActive} /> },
    {
      key: 'tasks',
      header: 'Active tasks',
      align: 'right',
      cell: (e) => <span className="text-ink-secondary tabular">{formatCount(e.workload.todo + e.workload.inProgress + e.workload.blocked)}</span>,
    },
    {
      key: 'completion',
      header: 'Completion',
      className: 'w-44',
      cell: (e) => <ProgressBar value={e.workload.completionRate} label={`${e.name} completion`} tone={toneForRisk(e.risk)} />,
    },
    { key: 'risk', header: 'Workload', cell: (e) => <RiskBadge risk={e.risk} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-12',
      cell: (e) => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${e.name}`}>
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem asChild>
              <Link href={`/employees/${e.id}`}>
                <UserRound />
                View profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/tasks?assigneeId=${e.id}`}>
                <ListChecks />
                View tasks
              </Link>
            </DropdownMenuItem>
            {isSuperAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setDialog({ kind: 'edit', id: e.id })}>
                  <Pencil />
                  Edit or change team
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog({ kind: 'reset', person: e })}>
                  <KeyRound />
                  Reset access
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive={e.isActive} onSelect={() => setDialog({ kind: 'status', person: e })}>
                  {e.isActive ? <UserRoundX /> : <UserRoundCheck />}
                  {e.isActive ? 'Deactivate' : 'Reactivate'}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={isSuperAdmin ? 'Employees' : 'Team members'}
        description={isSuperAdmin ? 'People, teams and workload across the organization' : 'Employees in the teams you manage'}
        actions={
          can('users.create') && (
            <Button onClick={() => setDialog({ kind: 'create' })}>
              <Plus />
              Add Employee
            </Button>
          )
        }
      />
      {isSuperAdmin && <PeopleTabs />}

      <KpiGrid className="mb-6 xl:grid-cols-4">
        <KpiCard label="Total Employees" value={formatCount(stats.data?.total ?? 0)} loading={stats.isPending} footnote="Excludes admins" />
        <KpiCard label="Active Employees" value={formatCount(stats.data?.active ?? 0)} loading={stats.isPending} footnote={`${formatCount(stats.data?.inactive ?? 0)} inactive`} />
        <KpiCard label="Teams" value={formatCount(stats.data?.teams ?? 0)} loading={stats.isPending} footnote="Active teams in scope" />
        <KpiCard
          label="Avg. active tasks"
          value={stats.data?.averageActiveTasks.toFixed(1) ?? '0'}
          loading={stats.isPending}
          footnote="Per active employee"
          info="Open tasks (to do, in progress, blocked) divided by active employees."
        />
      </KpiGrid>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={query.search ?? ''} onChange={(search) => setParams({ search })} label="Search employees" className="sm:w-72" />
        <Select aria-label="Team" value={query.teamId ?? ''} onChange={(e) => setParams({ teamId: e.target.value })} className="sm:w-48 [&_select]:sm:h-9">
          <option value="">All teams</option>
          {(teams.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Status" value={query.status ?? ''} onChange={(e) => setParams({ status: e.target.value })} className="sm:w-40 [&_select]:sm:h-9">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      <DataTable
        caption="Employees"
        columns={columns}
        rows={employees.data?.items}
        getRowId={(e) => e.id}
        loading={employees.isPending}
        error={employees.error}
        onRetry={() => employees.refetch()}
        sort={{ key: query.sort, order: query.order }}
        onSortChange={(key) => setParams({ sort: key, order: query.sort === key && query.order === 'asc' ? 'desc' : 'asc' }, { resetPage: false })}
        minWidth="min-w-[1180px]"
        empty={
          <EmptyState
            icon={Users}
            title={query.search || query.teamId || query.status ? 'No employees match these filters' : 'No employees yet'}
            description={can('users.create') ? 'Add employees to a team to start assigning work.' : undefined}
          />
        }
        footer={
          employees.data &&
          employees.data.meta.total > 0 && (
            <Pagination
              meta={employees.data.meta}
              noun="employees"
              onPageChange={(page) => setParams({ page }, { resetPage: false })}
              onPageSizeChange={(pageSize) => setParams({ pageSize })}
            />
          )
        }
      />

      {dialog?.kind === 'create' && <EmployeeFormDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <EditEmployee id={dialog.id} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'status' && <AccountStatusDialog account={dialog.person} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'reset' && <PasswordResetDialog account={dialog.person} onClose={() => setDialog(null)} />}
    </>
  );
}

function EditEmployee({ id, onClose }: { id: string; onClose: () => void }) {
  const employee = useEmployee(id);
  return employee.data ? <EmployeeFormDialog employee={employee.data} onClose={onClose} /> : null;
}
