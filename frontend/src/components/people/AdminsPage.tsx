'use client';

import { listPeopleQuerySchema, type AdminListItem } from '@zemp/shared';
import { EllipsisVertical, KeyRound, Pencil, Plus, ShieldCheck, UserRound, UserRoundCheck, UserRoundX } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
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
import { Select } from '@/components/ui/Select';
import { useAdmins } from '@/hooks/usePeople';
import { useTeamOptions } from '@/hooks/useTeams';
import { parseSearchParams, useUrlParams } from '@/hooks/useUrlParams';
import { formatCount } from '@/lib/format';
import { useUser } from '@/lib/session';
import { AccountStatusDialog, PasswordResetDialog } from './AccountActions';
import { AdminFormDialog } from './PersonForms';

type Dialog = { kind: 'create' } | { kind: 'edit' | 'status' | 'reset'; admin: AdminListItem };

/** Super Admin only (Frontend.md §48). */
export function AdminsPage() {
  const user = useUser();
  const [params, setParams] = useUrlParams();
  const query = useMemo(() => parseSearchParams(listPeopleQuerySchema, params), [params]);
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const admins = useAdmins(query);
  const teams = useTeamOptions(isSuperAdmin);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  if (!isSuperAdmin) return <AccessDenied />;

  const columns: Column<AdminListItem>[] = [
    {
      key: 'name',
      header: 'Admin',
      sortKey: 'name',
      cell: (a) => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={a.name} size="sm" />
          <div className="min-w-0">
            <Link href={`/employees/${a.id}`} className="block truncate font-medium text-ink hover:underline">
              {a.name}
            </Link>
            <p className="truncate text-meta text-ink-muted">{a.jobTitle ?? a.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'teams',
      header: 'Teams',
      cell: (a) =>
        a.teams.length ? (
          <span className="text-ink-secondary">{a.teams.map((t) => t.name).join(', ')}</span>
        ) : (
          <span className="text-meta text-warning-ink">No team assigned</span>
        ),
    },
    { key: 'employees', header: 'Employees', align: 'right', cell: (a) => <span className="tabular text-ink-secondary">{formatCount(a.employeeCount)}</span> },
    {
      key: 'tasks',
      header: 'Own tasks',
      align: 'right',
      cell: (a) => (
        <span className="tabular text-ink-secondary">
          {formatCount(a.workload.remaining)} open{a.workload.overdue ? <span className="text-danger-ink"> · {a.workload.overdue} overdue</span> : ''}
        </span>
      ),
    },
    { key: 'risk', header: 'Workload', cell: (a) => <RiskBadge risk={a.risk} /> },
    { key: 'status', header: 'Status', cell: (a) => <ActiveBadge active={a.isActive} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-12',
      cell: (a) => (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.name}`}>
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem asChild>
              <Link href={`/employees/${a.id}`}>
                <UserRound />
                View profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog({ kind: 'edit', admin: a })}>
              <Pencil />
              Edit or change teams
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog({ kind: 'reset', admin: a })}>
              <KeyRound />
              Reset access
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive={a.isActive} onSelect={() => setDialog({ kind: 'status', admin: a })}>
              {a.isActive ? <UserRoundX /> : <UserRoundCheck />}
              {a.isActive ? 'Deactivate' : 'Reactivate'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const account = (a: AdminListItem) => ({ id: a.id, name: a.name, isActive: a.isActive, role: 'ADMIN' as const });

  return (
    <>
      <PageHeader
        title="Admins"
        description="Admins manage the teams they own"
        actions={
          <Button onClick={() => setDialog({ kind: 'create' })}>
            <Plus />
            Add Admin
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={query.search ?? ''} onChange={(search) => setParams({ search })} label="Search admins" className="sm:w-72" />
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
        caption="Admins"
        columns={columns}
        rows={admins.data?.items}
        getRowId={(a) => a.id}
        loading={admins.isPending}
        error={admins.error}
        onRetry={() => admins.refetch()}
        sort={{ key: query.sort, order: query.order }}
        onSortChange={(key) => setParams({ sort: key, order: query.sort === key && query.order === 'asc' ? 'desc' : 'asc' }, { resetPage: false })}
        empty={<EmptyState icon={ShieldCheck} title="No admins match these filters" />}
        footer={
          admins.data &&
          admins.data.meta.total > 0 && (
            <Pagination meta={admins.data.meta} noun="admins" onPageChange={(page) => setParams({ page }, { resetPage: false })} />
          )
        }
      />
      {dialog?.kind === 'create' && <AdminFormDialog onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <AdminFormDialog admin={dialog.admin} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'status' && <AccountStatusDialog account={account(dialog.admin)} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'reset' && <PasswordResetDialog account={account(dialog.admin)} onClose={() => setDialog(null)} />}
    </>
  );
}
