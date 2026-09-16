'use client';

import type { OrgChartAdmin, OrgChartTeam, UserRef } from '@zemp/shared';
import { ChevronDown, Network } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { AccessDenied, EmptyState, ErrorState } from '@/components/shared/States';
import { UserAvatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useOrgChart, useTeamMembers } from '@/hooks/useTeams';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import { useUser } from '@/lib/session';
import { PeopleTabs } from './PeopleTabs';

/**
 * Super Admin → Admins → Teams → Employees (Frontend.md §42, §116). A view for orientation;
 * tables and forms remain the way to change the hierarchy.
 */
export function OrganizationChart() {
  const user = useUser();
  const chart = useOrgChart();
  if (user.role !== 'SUPER_ADMIN') return <AccessDenied />;

  return (
    <>
      <PageHeader
        title="Employees"
        description={
          chart.data
            ? `${plural(chart.data.totals.admins, 'admin')} · ${plural(chart.data.totals.teams, 'team')} · ${plural(chart.data.totals.employees, 'active employee')}`
            : 'Organization structure'
        }
      />
      <PeopleTabs />
      {chart.error ? (
        <ErrorState onRetry={() => chart.refetch()} />
      ) : !chart.data ? (
        <div className="grid justify-items-center gap-6">
          <Skeleton className="h-20 w-64 rounded-lg" />
          <div className="grid w-full gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="mx-auto flex min-w-fit flex-col items-center">
            {chart.data.superAdmins.map((sa) => (
              <PersonNode key={sa.id} person={sa} caption="Super Admin" emphasis />
            ))}
            {chart.data.admins.length > 0 && <div className="h-6 w-px bg-border-strong" aria-hidden />}
            {/* Connector spans from the first to the last admin column centre (each column is w-72). */}
            <ul className="relative flex gap-6 pt-6 before:absolute before:top-0 before:right-36 before:left-36 before:h-px before:bg-border-strong">
              {chart.data.admins.map((admin) => (
                <li key={admin.id} className="relative flex w-72 flex-col items-center before:absolute before:-top-6 before:h-6 before:w-px before:bg-border-strong">
                  <AdminBranch admin={admin} />
                </li>
              ))}
            </ul>
            {chart.data.unownedTeams.length > 0 && (
              <section className="mt-10 w-full max-w-3xl">
                <h2 className="mb-3 text-sm font-semibold text-ink">Teams without an admin</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {chart.data.unownedTeams.map((team) => (
                    <li key={team.id}>
                      <TeamNode team={team} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {chart.data.admins.length === 0 && <EmptyState icon={Network} title="No admins yet" description="Add admins and assign teams to build the hierarchy." />}
          </div>
        </div>
      )}
    </>
  );
}

function PersonNode({ person, caption, emphasis }: { person: UserRef; caption: string; emphasis?: boolean }) {
  return (
    <Link
      href={`/employees/${person.id}`}
      className={cn(
        'flex w-64 items-center gap-3 rounded-lg border bg-surface p-3.5 shadow-card transition-shadow hover:shadow-elevated',
        emphasis ? 'border-primary-muted' : 'border-border-subtle',
      )}
    >
      <UserAvatar name={person.name} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{person.name}</p>
        <p className="truncate text-meta text-ink-muted">{caption}</p>
      </div>
      {!person.isActive && (
        <Badge tone="danger" className="ml-auto h-6">
          Inactive
        </Badge>
      )}
    </Link>
  );
}

function AdminBranch({ admin }: { admin: OrgChartAdmin }) {
  return (
    <>
      <PersonNode person={admin} caption={`Admin · ${plural(admin.employeeCount, 'employee')}`} />
      {admin.teams.length > 0 && <div className="h-4 w-px bg-border-strong" aria-hidden />}
      <ul className="grid w-full gap-3">
        {admin.teams.map((team) => (
          <li key={team.id}>
            <TeamNode team={team} />
          </li>
        ))}
        {admin.teams.length === 0 && <p className="mt-3 text-center text-meta text-warning-ink">No team assigned</p>}
      </ul>
    </>
  );
}

function TeamNode({ team }: { team: OrgChartTeam }) {
  const [expanded, setExpanded] = useState(false);
  const members = useTeamMembers(team.id, expanded);
  const panelId = `team-${team.id}`;
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-subtle">
      <div className="flex items-center gap-2 p-3">
        <Link href={`/teams/${team.id}`} className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink hover:underline">{team.name}</p>
          <p className="text-meta text-ink-muted">{plural(team.memberCount, 'employee')}</p>
        </Link>
        {team.memberCount > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((v) => !v)}
            className="flex h-8 items-center gap-1 rounded-sm px-2 text-meta font-medium text-ink-secondary hover:bg-surface-hover"
          >
            {expanded ? 'Hide' : 'Show'}
            <ChevronDown className={cn('size-3.5 transition-transform duration-200', expanded && 'rotate-180')} aria-hidden />
          </button>
        )}
      </div>
      {expanded && (
        <ul id={panelId} className="grid gap-1 border-t border-border-subtle p-2">
          {members.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            members.data?.map((m) => (
              <li key={m.id}>
                <Link href={`/employees/${m.id}`} className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-surface-hover">
                  <UserAvatar name={m.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-ink-secondary">{m.name}</span>
                  <span className="truncate text-meta text-ink-muted">{m.jobTitle}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
