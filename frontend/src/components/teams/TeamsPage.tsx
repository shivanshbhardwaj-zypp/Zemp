'use client';

import { listTeamsQuerySchema, type TeamListItem } from '@zemp/shared';
import { Plus, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { SearchInput } from '@/components/shared/SearchInput';
import { AccessDenied, EmptyState, ErrorState } from '@/components/shared/States';
import { Badge, RiskBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar, toneForRisk } from '@/components/ui/ProgressBar';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTeams } from '@/hooks/useTeams';
import { parseSearchParams, useUrlParams } from '@/hooks/useUrlParams';
import { formatCount, plural } from '@/lib/format';
import { useCan, useUser } from '@/lib/session';
import { TeamFormDialog } from './TeamDialogs';

export function TeamsPage() {
  const user = useUser();
  const can = useCan();
  const router = useRouter();
  const [params, setParams] = useUrlParams();
  const query = useMemo(() => parseSearchParams(listTeamsQuerySchema, params), [params]);
  const allowed = can('teams.read');
  const teams = useTeams({ ...query, pageSize: 12 }, { enabled: allowed });
  const [creating, setCreating] = useState(false);
  const singleOwnedTeam = user.role === 'ADMIN' && user.ownedTeams.length === 1 ? user.ownedTeams[0] : null;

  // "My Team" for an admin with one team goes straight to that team (Frontend.md §124).
  useEffect(() => {
    if (singleOwnedTeam) router.replace(`/teams/${singleOwnedTeam.id}`);
  }, [singleOwnedTeam, router]);

  if (!allowed) return <AccessDenied />;
  if (singleOwnedTeam) return <Skeleton className="h-64 w-full rounded-lg" />;

  return (
    <>
      <PageHeader
        title={user.role === 'SUPER_ADMIN' ? 'Teams' : 'My Teams'}
        description={user.role === 'SUPER_ADMIN' ? 'Every team, its admin and current workload' : 'The teams you manage'}
        actions={
          can('teams.create') && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Create Team
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={query.search ?? ''} onChange={(search) => setParams({ search })} label="Search teams" className="sm:w-72" />
        <Select aria-label="Status" value={query.status ?? ''} onChange={(e) => setParams({ status: e.target.value })} className="sm:w-40 [&_select]:sm:h-9">
          <option value="">All teams</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>
      {teams.error ? (
        <ErrorState onRetry={() => teams.refetch()} />
      ) : !teams.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-lg" />
          ))}
        </div>
      ) : teams.data.items.length === 0 ? (
        <EmptyState icon={UsersRound} title="No teams found" description={can('teams.create') ? 'Create a team to group employees under an admin.' : undefined} />
      ) : (
        <>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teams.data.items.map((team) => (
              <li key={team.id}>
                <TeamCard team={team} />
              </li>
            ))}
          </ul>
          {teams.data.meta.totalPages > 1 && (
            <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle bg-surface">
              <Pagination meta={teams.data.meta} noun="teams" onPageChange={(page) => setParams({ page }, { resetPage: false })} />
            </div>
          )}
        </>
      )}
      {creating && <TeamFormDialog onClose={() => setCreating(false)} />}
    </>
  );
}

/** Team name · admin · members · active tasks · completion (Frontend.md §86). The whole card opens the team. */
function TeamCard({ team }: { team: TeamListItem }) {
  const w = team.workload;
  return (
    <Link href={`/teams/${team.id}`} className="block h-full rounded-lg">
      <Card className="flex h-full flex-col p-5 transition-shadow duration-200 hover:shadow-elevated">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">{team.name}</p>
            <p className="truncate text-meta text-ink-muted">{team.owner ? `Admin: ${team.owner.name}` : 'No admin yet'}</p>
          </div>
          {team.isActive ? <RiskBadge risk={team.risk} /> : <Badge tone="neutral">Inactive</Badge>}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          {[
            ['Members', team.memberCount],
            ['Active tasks', w.todo + w.inProgress + w.blocked],
            ['Overdue', w.overdue],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-meta text-ink-muted">{label}</dt>
              <dd className="mt-0.5 font-semibold text-ink tabular">{formatCount(Number(value))}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto pt-4">
          <ProgressBar value={w.completionRate} label={`${team.name} completion`} tone={toneForRisk(team.risk)} />
          <p className="mt-1.5 text-meta text-ink-muted">
            {plural(w.completed, 'task')} of {formatCount(w.total)} completed{team.atRiskMembers ? ` · ${plural(team.atRiskMembers, 'member')} at risk` : ''}
          </p>
        </div>
      </Card>
    </Link>
  );
}
