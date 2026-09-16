/** PHASE A MOCK — dashboard, daily/progress reports and the activity feed. */
import {
  DAY_MS,
  DomainError,
  activityFeedQuerySchema,
  addDays,
  byRiskThenName,
  canViewTask,
  completionRate,
  countInDay,
  dailyReportQuerySchema,
  dailyTrend,
  dayBounds,
  dayKey,
  dayRange,
  isOpenStatus,
  progressReportQuerySchema,
  startOfDay,
  summarizeWorkload,
  taskRisk,
  toPersonProgress,
  toTeamProgress,
  type ActivityFeedItem,
  type DailyReport,
  type DashboardAttention,
  type DashboardSummary,
  type PersonProgress,
  type ProgressPoint,
  type ProgressReport,
  type RiskLevel,
  type ScopeInfo,
  type TeamProgress,
  type WorkloadSummary,
} from '@zemp/shared';
import type { SeedSnapshot, SeedTask, SeedTeam, SeedUser } from '@zemp/shared/seed';
import {
  activityEntry,
  actorFor,
  currentTeam,
  db,
  findUser,
  ownedTeams,
  summarizeTask,
  teamMembers,
  teamRef,
  userRef,
  zone,
} from '../db';
import { get, parse, requirePermission } from '../http';

interface Scope {
  info: ScopeInfo;
  people: SeedUser[];
  teams: SeedTeam[];
  tasks: SeedTask[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Narrows reports to what the viewer may see, then to the requested team/admin/employee. */
function resolveScope(user: SeedUser, filters: { teamId?: string; adminId?: string; employeeId?: string }): Scope {
  const store = db();
  const actor = actorFor(user);
  let teams: SeedTeam[];
  let people: SeedUser[];
  if (user.role === 'SUPER_ADMIN') {
    teams = store.teams.filter((t) => t.isActive);
    people = store.users.filter((u) => u.role !== 'SUPER_ADMIN');
  } else if (user.role === 'ADMIN') {
    teams = ownedTeams(user.id);
    const teamIds = teams.map((t) => t.id);
    people = store.users.filter((u) => u.role === 'EMPLOYEE' && teamIds.includes(currentTeam(u.id)?.id ?? ''));
  } else {
    teams = [];
    people = [user];
  }

  let info: ScopeInfo;
  if (filters.adminId) {
    if (user.role !== 'SUPER_ADMIN') throw new DomainError('FORBIDDEN');
    teams = teams.filter((t) => t.ownerId === filters.adminId);
    people = people.filter((p) => teams.some((t) => t.id === currentTeam(p.id)?.id));
  }
  if (filters.teamId) {
    const team = teams.find((t) => t.id === filters.teamId);
    if (!team) throw new DomainError('TEAM_NOT_FOUND');
    teams = [team];
    people = people.filter((p) => currentTeam(p.id)?.id === team.id);
  }
  if (filters.employeeId) {
    const person = people.find((p) => p.id === filters.employeeId);
    if (!person) throw new DomainError('USER_NOT_FOUND');
    people = [person];
    teams = teams.filter((t) => t.id === currentTeam(person.id)?.id);
  }

  const activePeople = people.filter((p) => p.isActive && p.role === 'EMPLOYEE').length;
  if (user.role === 'EMPLOYEE') {
    info = { kind: 'SELF', label: 'My work', detail: currentTeam(user.id)?.name ?? 'No team' };
  } else if (filters.employeeId) {
    const person = people[0]!;
    info = { kind: 'PERSON', label: person.name, detail: currentTeam(person.id)?.name ?? 'No team' };
  } else if (user.role === 'SUPER_ADMIN' && !filters.teamId && !filters.adminId) {
    info = { kind: 'ORGANIZATION', label: 'Organization', detail: `All teams · ${plural(activePeople, 'employee')}` };
  } else {
    info = {
      kind: 'TEAM',
      label: teams.map((t) => t.name).join(', ') || 'No team',
      detail: plural(activePeople, 'employee'),
    };
  }

  const peopleIds = new Set(people.map((p) => p.id));
  const teamIds = new Set(teams.map((t) => t.id));
  const wholeOrganization = user.role === 'SUPER_ADMIN' && !filters.teamId && !filters.adminId && !filters.employeeId;
  const personal = user.role === 'EMPLOYEE' || !!filters.employeeId;
  const tasks = store.tasks.filter(
    (t) =>
      canViewTask(actor, t) &&
      (wholeOrganization ||
        (personal ? peopleIds.has(t.assigneeId) : (t.teamId !== null && teamIds.has(t.teamId)) || peopleIds.has(t.assigneeId))),
  );
  return { info, people, teams, tasks };
}

const isRisky = (risk: RiskLevel | null) => risk === 'AT_RISK' || risk === 'OVERDUE';

function livePeople(scope: Scope, now: Date): PersonProgress[] {
  return scope.people.map((p) => {
    const team = currentTeam(p.id);
    return toPersonProgress({
      user: userRef(p),
      team: team ? teamRef(team) : null,
      tasks: scope.tasks.filter((t) => t.assigneeId === p.id),
      now,
      timeZone: zone(),
    });
  });
}

function liveTeams(scope: Scope, now: Date): TeamProgress[] {
  return scope.teams.map((team) => {
    const owner = team.ownerId ? findUser(team.ownerId) : undefined;
    return toTeamProgress({
      team: teamRef(team),
      owner: owner ? userRef(owner) : null,
      memberCount: teamMembers(team.id).length,
      tasks: scope.tasks.filter((t) => t.teamId === team.id),
      now,
      timeZone: zone(),
    });
  });
}

get('/dashboard/summary', ({ user, now }) => {
  const scope = resolveScope(user, {});
  const tz = zone();
  const { start, end } = dayBounds(now, tz);
  return {
    date: dayKey(now, tz),
    scope: scope.info,
    workload: summarizeWorkload(scope.tasks, now, tz),
    completedToday: countInDay(scope.tasks.map((t) => (t.status === 'COMPLETED' ? t.completedAt : null)), now, tz),
    assignedToday: scope.tasks.filter((t) => t.createdAt >= start && t.createdAt < end).length,
    atRiskTasks: scope.tasks.filter((t) => taskRisk(t, now) === 'AT_RISK').length,
    people:
      user.role === 'EMPLOYEE'
        ? null
        : {
            total: scope.people.filter((p) => p.role === 'EMPLOYEE').length,
            active: scope.people.filter((p) => p.role === 'EMPLOYEE' && p.isActive).length,
          },
  } satisfies DashboardSummary;
});

get('/dashboard/attention', ({ user, now }) => {
  const scope = resolveScope(user, {});
  const actor = actorFor(user);
  const open = scope.tasks.filter((t) => isOpenStatus(t.status));
  const top = (tasks: SeedTask[]) =>
    tasks
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .slice(0, 6)
      .map((t) => summarizeTask(t, actor, now));
  const soon = now.getTime() + 2 * DAY_MS;
  return {
    overdue: top(open.filter((t) => t.dueAt < now)),
    blocked: top(open.filter((t) => t.status === 'BLOCKED')),
    dueSoon: top(open.filter((t) => t.dueAt >= now && t.dueAt.getTime() < soon)),
    atRiskPeople:
      user.role === 'EMPLOYEE'
        ? []
        : livePeople(scope, now)
            .filter((p) => isRisky(p.risk))
            .sort(byRiskThenName)
            .slice(0, 6),
    atRiskTeams:
      user.role === 'SUPER_ADMIN'
        ? liveTeams(scope, now)
            .filter((t) => isRisky(t.risk))
            .sort(byRiskThenName)
            .slice(0, 6)
        : [],
    inactivePeople: user.role === 'SUPER_ADMIN' ? db().users.filter((u) => !u.isActive).length : null,
  } satisfies DashboardAttention;
});

const emptyWorkload = (): WorkloadSummary => ({
  total: 0,
  completed: 0,
  remaining: 0,
  todo: 0,
  inProgress: 0,
  blocked: 0,
  overdue: 0,
  dueToday: 0,
  completionRate: 0,
});

function sumSnapshots(snapshots: readonly SeedSnapshot[]): WorkloadSummary {
  const w = emptyWorkload();
  for (const s of snapshots) {
    w.total += s.total;
    w.completed += s.completed;
    w.todo += s.todo;
    w.inProgress += s.inProgress;
    w.blocked += s.blocked;
    w.overdue += s.overdue;
  }
  w.remaining = w.total - w.completed;
  w.completionRate = completionRate(w.completed, w.total);
  return w;
}

const RISK_ORDER: RiskLevel[] = ['OVERDUE', 'AT_RISK', 'ON_TRACK', 'COMPLETED'];
const worstRisk = (risks: (RiskLevel | null)[]) => RISK_ORDER.find((r) => risks.includes(r)) ?? null;

get('/reports/daily', ({ user, query, now }) => {
  requirePermission(user, 'reports.read');
  const q = parse(dailyReportQuerySchema, query);
  const tz = zone();
  const today = dayKey(now, tz);
  const date = q.date ?? today;
  if (date > today) {
    throw new DomainError('VALIDATION_ERROR', 'Reports are not available for future dates.', {
      fieldErrors: { date: ['Choose today or an earlier date'] },
      formErrors: [],
    });
  }
  const scope = resolveScope(user, q);
  const isToday = date === today;
  const dayStart = startOfDay(date, tz);
  const dayEnd = startOfDay(addDays(date, 1), tz);
  const inDay = (d: Date) => d >= dayStart && d < dayEnd;
  const taskIds = new Set(scope.tasks.map((t) => t.id));
  const completions = db()
    .activities.filter((a) => a.type === 'COMPLETED' && taskIds.has(a.taskId))
    .map((a) => a.createdAt);

  let people: PersonProgress[];
  let teams: TeamProgress[];
  let workload: WorkloadSummary;
  if (isToday) {
    people = livePeople(scope, now);
    teams = liveTeams(scope, now);
    workload = summarizeWorkload(scope.tasks, now, tz);
  } else {
    const snapshots = db().snapshots.filter((s) => s.date === date);
    const peopleIds = new Set(scope.people.map((p) => p.id));
    people = scope.people.map((p) => {
      const snapshot = snapshots.find((s) => s.userId === p.id);
      const team = currentTeam(p.id);
      return {
        user: userRef(p),
        team: team ? teamRef(team) : null,
        workload: snapshot ? sumSnapshots([snapshot]) : emptyWorkload(),
        completedToday: snapshot?.completedOnDay ?? 0,
        risk: snapshot?.risk ?? null,
      };
    });
    teams = scope.teams.map((team) => {
      const members = snapshots.filter((s) => s.teamId === team.id);
      const owner = team.ownerId ? findUser(team.ownerId) : undefined;
      return {
        team: teamRef(team),
        owner: owner ? userRef(owner) : null,
        memberCount: teamMembers(team.id).length,
        workload: sumSnapshots(members),
        completedToday: members.reduce((sum, s) => sum + s.completedOnDay, 0),
        risk: worstRisk(members.map((s) => s.risk)),
      };
    });
    workload = sumSnapshots(snapshots.filter((s) => peopleIds.has(s.userId)));
  }

  return {
    date,
    isToday,
    source: isToday ? 'LIVE' : 'SNAPSHOT',
    scope: scope.info,
    summary: {
      assignedToday: scope.tasks.filter((t) => inDay(t.createdAt)).length,
      completedToday: completions.filter(inDay).length,
      inProgress: workload.inProgress,
      blocked: workload.blocked,
      overdue: workload.overdue,
      completionRate: workload.completionRate,
      activeEmployees: scope.people.filter((p) => p.isActive && p.role === 'EMPLOYEE').length,
      activeAdmins: scope.people.filter((p) => p.isActive && p.role === 'ADMIN').length,
      atRiskPeople: people.filter((p) => isRisky(p.risk)).length,
    },
    workload,
    teams: teams.sort(byRiskThenName),
    people: people.filter((p) => p.workload.total > 0 || p.user.isActive).sort(byRiskThenName),
    trend: dailyTrend({
      assignments: scope.tasks.map((t) => t.createdAt),
      completions,
      endKey: date,
      days: 7,
      timeZone: tz,
    }),
  } satisfies DailyReport;
});

get('/reports/progress', ({ user, query, now }) => {
  requirePermission(user, 'reports.read');
  const q = parse(progressReportQuerySchema, query);
  const tz = zone();
  const today = dayKey(now, tz);
  const scope = resolveScope(user, q);
  const days = dayRange(q.from, q.to > today ? today : q.to);
  const snapshots = db().snapshots;

  const point = (date: string, userIds: readonly string[]): ProgressPoint => {
    const workload =
      date === today
        ? summarizeWorkload(scope.tasks.filter((t) => userIds.includes(t.assigneeId)), now, tz)
        : sumSnapshots(snapshots.filter((s) => s.date === date && userIds.includes(s.userId)));
    return { date, total: workload.total, completed: workload.completed, completionRate: workload.completionRate };
  };

  const rows = scope.people
    .map((p) => {
      const team = currentTeam(p.id);
      return { user: userRef(p), team: team ? teamRef(team) : null, points: days.map((d) => point(d, [p.id])) };
    })
    .filter((row) => row.points.some((pt) => pt.total > 0))
    .sort((a, b) => a.user.name.localeCompare(b.user.name));

  const everyone = scope.people.map((p) => p.id);
  return {
    from: q.from,
    to: days.at(-1) ?? q.from,
    days,
    scope: scope.info,
    totals: days.map((d) => point(d, everyone)),
    rows,
  } satisfies ProgressReport;
});

get('/activity', ({ user, query }) => {
  const q = parse(activityFeedQuerySchema, query);
  const scope = resolveScope(user, q);
  const tz = zone();
  const titles = new Map(scope.tasks.map((t) => [t.id, t.title]));
  let events = db().activities.filter((a) => titles.has(a.taskId));
  if (q.date) {
    const start = startOfDay(q.date, tz);
    const end = startOfDay(addDays(q.date, 1), tz);
    events = events.filter((a) => a.createdAt >= start && a.createdAt < end);
  }
  return events
    .slice(-q.limit)
    .reverse()
    .map((a): ActivityFeedItem => ({ ...activityEntry(a), task: { id: a.taskId, title: titles.get(a.taskId)! } }));
});
