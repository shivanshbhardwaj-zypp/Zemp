/** PHASE A MOCK — teams, membership and the organization chart. */
import {
  DomainError,
  addTeamMemberSchema,
  ROLE_PERMISSIONS,
  canDelegateRole,
  canViewTask,
  canViewTeam,
  createTeamSchema,
  listTeamsQuerySchema,
  summarizeWorkload,
  toPersonProgress,
  updateTeamSchema,
  workloadRisk,
  type OrgChart,
  type OrgChartTeam,
  type TeamDetail,
  type TeamListItem,
  type TeamMemberItem,
} from '@zemp/shared';
import type { SeedTeam, SeedUser } from '@zemp/shared/seed';
import {
  actorFor,
  addAudit,
  currentTeam,
  db,
  findTeam,
  findUser,
  newId,
  ownedTeams,
  teamMembers,
  teamRef,
  userRef,
  zone,
} from '../db';
import { Paged, fieldError, get, paginate, parse, patch, post, requirePermission } from '../http';

function teamItem(team: SeedTeam, now: Date): TeamListItem {
  const tz = zone();
  const tasks = db().tasks.filter((t) => t.teamId === team.id);
  const members = teamMembers(team.id);
  const owner = team.ownerId ? findUser(team.ownerId) : undefined;
  const atRiskMembers = members.filter((m) => {
    const risk = workloadRisk(tasks.filter((t) => t.assigneeId === m.id), now, tz);
    return risk === 'AT_RISK' || risk === 'OVERDUE';
  }).length;
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    isActive: team.isActive,
    owner: owner ? userRef(owner) : null,
    memberCount: members.length,
    workload: summarizeWorkload(tasks, now, tz),
    atRiskMembers,
    risk: workloadRisk(tasks, now, tz),
    createdAt: team.createdAt.toISOString(),
  };
}

function loadTeam(user: SeedUser, id: string) {
  const team = findTeam(id);
  if (!team || !canViewTeam(actorFor(user), team.id)) throw new DomainError('TEAM_NOT_FOUND');
  return team;
}

const teamDetail = (team: SeedTeam, user: SeedUser, now: Date): TeamDetail => ({
  ...teamItem(team, now),
  permissions: { canEdit: user.role === 'SUPER_ADMIN', canManageMembers: user.role === 'SUPER_ADMIN' },
});

function assertOwner(ownerId: string | null | undefined) {
  if (!ownerId) return;
  const owner = findUser(ownerId);
  if (!owner || owner.role !== 'ADMIN' || !owner.isActive) {
    throw fieldError('INVALID_REFERENCE', 'ownerId', 'Choose an active admin.');
  }
}

function assertUniqueName(name: string | undefined, exceptId?: string) {
  if (name && db().teams.some((t) => t.id !== exceptId && t.name.toLowerCase() === name.toLowerCase())) {
    throw fieldError('TEAM_NAME_TAKEN', 'name');
  }
}

get('/teams', ({ user, query, now }) => {
  requirePermission(user, 'teams.read');
  const q = parse(listTeamsQuerySchema, query);
  const search = q.search?.toLowerCase();
  const scope = user.role === 'SUPER_ADMIN' ? db().teams : ownedTeams(user.id);
  const teams = scope.filter(
    (t) =>
      (!search || t.name.toLowerCase().includes(search)) && (!q.status || t.isActive === (q.status === 'active')),
  );
  const direction = q.order === 'asc' ? 1 : -1;
  teams.sort(
    (a, b) =>
      (q.sort === 'createdAt' ? a.createdAt.getTime() - b.createdAt.getTime() : a.name.localeCompare(b.name)) * direction,
  );
  const page = paginate(teams, q.page, q.pageSize);
  return new Paged(page.items.map((t) => teamItem(t, now)), page.meta);
});

post('/teams', ({ req, user, body, now }) => {
  requirePermission(user, 'teams.create');
  const input = parse(createTeamSchema, body);
  assertUniqueName(input.name);
  assertOwner(input.ownerId);
  const team: SeedTeam = {
    id: newId(),
    name: input.name,
    description: input.description || null,
    ownerId: input.ownerId ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  db().teams.push(team);
  addAudit(req, now, user.id, 'TEAM_CREATED', 'TEAM', team.id, { name: team.name, ownerId: team.ownerId });
  return teamDetail(team, user, now);
});

get('/teams/:id', ({ user, params, now }) => teamDetail(loadTeam(user, params.id!), user, now));

patch('/teams/:id', ({ req, user, params, body, now }) => {
  requirePermission(user, 'teams.update');
  const input = parse(updateTeamSchema, body);
  const team = loadTeam(user, params.id!);
  assertUniqueName(input.name, team.id);
  assertOwner(input.ownerId);
  if (input.isActive === false && teamMembers(team.id).length > 0) throw new DomainError('TEAM_HAS_ACTIVE_MEMBERS');
  const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  Object.assign(team, changes, { updatedAt: now });
  addAudit(req, now, user.id, 'TEAM_UPDATED', 'TEAM', team.id, { fields: Object.keys(changes) });
  return teamDetail(team, user, now);
});

get('/teams/:id/members', ({ user, params, now }) => {
  const team = loadTeam(user, params.id!);
  const actor = actorFor(user);
  const tz = zone();
  return db()
    .users.filter((u) => currentTeam(u.id)?.id === team.id)
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name))
    .map((u): TeamMemberItem => {
      const tasks = db().tasks.filter((t) => t.assigneeId === u.id && canViewTask(actor, t));
      const progress = toPersonProgress({ user: userRef(u), team: teamRef(team), tasks, now, timeZone: tz });
      const membership = db().memberships.find((m) => m.userId === u.id && !m.leftAt)!;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        employeeCode: u.employeeCode,
        jobTitle: u.jobTitle,
        role: u.role,
        isActive: u.isActive,
        joinedAt: membership.joinedAt.toISOString(),
        canDelegate:
          ROLE_PERMISSIONS[user.role].includes('users.delegate') &&
          canDelegateRole(actor, { id: u.id, role: u.role, teamId: team.id }),
        workload: progress.workload,
        risk: progress.risk,
      };
    });
});

post('/teams/:id/members', ({ req, user, params, body, now }) => {
  requirePermission(user, 'users.update');
  const input = parse(addTeamMemberSchema, body);
  const team = loadTeam(user, params.id!);
  if (!team.isActive) throw new DomainError('INVALID_TEAM', 'This team is inactive.');
  const person = findUser(input.userId);
  if (!person || person.role !== 'EMPLOYEE') throw fieldError('INVALID_REFERENCE', 'userId', 'Choose an employee.');
  const from = currentTeam(person.id);
  if (from?.id !== team.id) {
    for (const membership of db().memberships) {
      if (membership.userId === person.id && !membership.leftAt) membership.leftAt = now;
    }
    db().memberships.push({ id: newId(), teamId: team.id, userId: person.id, joinedAt: now, leftAt: null });
    addAudit(req, now, user.id, 'TEAM_MEMBER_MOVED', 'USER', person.id, { fromTeamId: from?.id ?? null, toTeamId: team.id });
  }
  return teamDetail(team, user, now);
});

get('/organization/chart', ({ user }) => {
  if (user.role !== 'SUPER_ADMIN') throw new DomainError('FORBIDDEN');
  const store = db();
  const chartTeam = (t: SeedTeam): OrgChartTeam => ({ ...teamRef(t), isActive: t.isActive, memberCount: teamMembers(t.id).length });
  // Anyone who owns a team gets a branch — including a Super Admin who also runs one directly.
  const ownerIds = new Set(store.teams.map((t) => t.ownerId).filter((id): id is string => id !== null));
  const admins = store.users.filter((u) => ownerIds.has(u.id));
  return {
    superAdmins: store.users.filter((u) => u.role === 'SUPER_ADMIN').map(userRef),
    admins: admins
      .map((a) => {
        const teams = store.teams.filter((t) => t.ownerId === a.id).map(chartTeam);
        return { ...userRef(a), teams, employeeCount: teams.reduce((sum, t) => sum + t.memberCount, 0) };
      })
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)),
    unownedTeams: store.teams.filter((t) => !t.ownerId).map(chartTeam),
    totals: {
      admins: admins.filter((a) => a.isActive).length,
      employees: store.users.filter((u) => u.role === 'EMPLOYEE' && u.isActive).length,
      teams: store.teams.filter((t) => t.isActive).length,
    },
  } satisfies OrgChart;
});
