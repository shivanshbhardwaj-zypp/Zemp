import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DAY_MS,
  DomainError,
  activityFeedQuerySchema,
  addDays,
  byRiskThenName,
  canReviewTask,
  canViewTask,
  completionRate,
  countInDay,
  dailyReportQuerySchema,
  dailyTrend,
  dayBounds,
  dayKey,
  dayRange,
  isOpenStatus,
  isTeamManagerRole,
  isTeamMemberRole,
  progressReportQuerySchema,
  startOfDay,
  summarizeWorkload,
  taskRisk,
  toPersonProgress,
  toTeamProgress,
  type ActivityFeedItem,
  type ActivityFeedQuery,
  type DailyReport,
  type DailyReportQuery,
  type DashboardAttention,
  type DashboardSummary,
  type PersonProgress,
  type ProgressPoint,
  type ProgressReport,
  type ProgressReportQuery,
  type RiskLevel,
  type ScopeInfo,
  type TeamProgress,
  type WorkloadSummary,
} from '@zemp/shared';
import { CurrentUser, Now, RequirePermissions } from '../../common/auth.js';
import { zodPipe } from '../../common/http.js';
import {
  StoreService,
  type SeedSnapshot,
  type SeedTask,
  type SeedTeam,
  type SeedUser,
} from '../../data/store.service.js';

interface Scope {
  info: ScopeInfo;
  people: SeedUser[];
  teams: SeedTeam[];
  tasks: SeedTask[];
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const isRisky = (risk: RiskLevel | null) => risk === 'AT_RISK' || risk === 'OVERDUE';

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

/** Past days come from stored snapshots, which are per-person; a team is the sum of its people. */
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

/**
 * Dashboards and reports. Numbers are computed here from authoritative task data — never accepted
 * from the client (requirements §21) — and always inside the viewer's scope.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly store: StoreService) {}

  /**
   * Narrows every report to what the viewer may see, then to the requested team/admin/employee.
   * A filter naming something outside their scope fails as not found rather than silently widening.
   */
  private resolveScope(user: SeedUser, filters: { teamId?: string; adminId?: string; employeeId?: string }): Scope {
    let teams: SeedTeam[];
    let people: SeedUser[];

    if (user.role === 'SUPER_ADMIN') {
      teams = this.store.teams.filter((t) => t.isActive);
      people = this.store.users.filter((u) => u.role !== 'SUPER_ADMIN');
    } else if (isTeamManagerRole(user.role)) {
      // A sub admin manages exactly the team they belong to; an admin, every team they own.
      teams = this.store
        .managedTeamIds(user)
        .map((id) => this.store.findTeam(id))
        .filter((t): t is SeedTeam => Boolean(t));
      people = this.store.staffOfTeams(teams.map((t) => t.id));
    } else {
      teams = [];
      people = [user];
    }

    if (filters.adminId) {
      if (user.role !== 'SUPER_ADMIN') throw new DomainError('FORBIDDEN');
      teams = teams.filter((t) => t.ownerId === filters.adminId);
      people = people.filter((p) => teams.some((t) => t.id === this.store.currentTeam(p.id)?.id));
    }
    if (filters.teamId) {
      const team = teams.find((t) => t.id === filters.teamId);
      if (!team) throw new DomainError('TEAM_NOT_FOUND');
      teams = [team];
      people = people.filter((p) => this.store.currentTeam(p.id)?.id === team.id);
    }
    if (filters.employeeId) {
      // You can always ask about your own work, even when you are not one of your team's staff
      // (an admin manages a team without being a member of it).
      const person = filters.employeeId === user.id ? user : people.find((p) => p.id === filters.employeeId);
      if (!person) throw new DomainError('USER_NOT_FOUND');
      people = [person];
      teams = teams.filter((t) => t.id === this.store.currentTeam(person.id)?.id);
    }

    const activePeople = people.filter((p) => p.isActive && isTeamMemberRole(p.role)).length;
    let info: ScopeInfo;
    if (user.role === 'EMPLOYEE') {
      info = { kind: 'SELF', label: 'My work', detail: this.store.currentTeam(user.id)?.name ?? 'No team' };
    } else if (filters.employeeId) {
      const person = people[0]!;
      info = { kind: 'PERSON', label: person.name, detail: this.store.currentTeam(person.id)?.name ?? 'No team' };
    } else if (user.role === 'SUPER_ADMIN' && !filters.teamId && !filters.adminId) {
      info = { kind: 'ORGANIZATION', label: 'Organization', detail: `All teams · ${plural(activePeople, 'employee')}` };
    } else {
      info = {
        kind: 'TEAM',
        label: teams.map((t) => t.name).join(', ') || 'No team',
        detail: plural(activePeople, 'employee'),
      };
    }

    const actor = this.store.actorFor(user);
    const peopleIds = new Set(people.map((p) => p.id));
    const teamIds = new Set(teams.map((t) => t.id));
    const wholeOrganization = user.role === 'SUPER_ADMIN' && !filters.teamId && !filters.adminId && !filters.employeeId;
    const personal = user.role === 'EMPLOYEE' || Boolean(filters.employeeId);
    const tasks = this.store.tasks.filter(
      (t) =>
        canViewTask(actor, t) &&
        (wholeOrganization ||
          (personal
            ? peopleIds.has(t.assigneeId)
            : (t.teamId !== null && teamIds.has(t.teamId)) || peopleIds.has(t.assigneeId))),
    );
    return { info, people, teams, tasks };
  }

  private livePeople(scope: Scope, now: Date): PersonProgress[] {
    return scope.people.map((p) => {
      const team = this.store.currentTeam(p.id);
      return toPersonProgress({
        user: this.store.userRef(p),
        team: team ? this.store.teamRef(team) : null,
        tasks: scope.tasks.filter((t) => t.assigneeId === p.id),
        now,
        timeZone: this.store.timeZone,
      });
    });
  }

  private liveTeams(scope: Scope, now: Date): TeamProgress[] {
    return scope.teams.map((team) => {
      const owner = team.ownerId ? this.store.findUser(team.ownerId) : undefined;
      return toTeamProgress({
        team: this.store.teamRef(team),
        owner: owner ? this.store.userRef(owner) : null,
        memberCount: this.store.teamMembers(team.id).length,
        tasks: scope.tasks.filter((t) => t.teamId === team.id),
        now,
        timeZone: this.store.timeZone,
      });
    });
  }

  summary(user: SeedUser, now: Date): DashboardSummary {
    const scope = this.resolveScope(user, {});
    const tz = this.store.timeZone;
    const { start, end } = dayBounds(now, tz);
    const actor = this.store.actorFor(user);
    return {
      date: dayKey(now, tz),
      scope: scope.info,
      workload: summarizeWorkload(scope.tasks, now, tz),
      completedToday: countInDay(
        scope.tasks.map((t) => (t.status === 'COMPLETED' ? t.completedAt : null)),
        now,
        tz,
      ),
      assignedToday: scope.tasks.filter((t) => t.createdAt >= start && t.createdAt < end).length,
      atRiskTasks: scope.tasks.filter((t) => taskRisk(t, now) === 'AT_RISK').length,
      people:
        user.role === 'EMPLOYEE'
          ? null
          : {
              // Sub admins still do the team's work, so they count as staff here too.
              total: scope.people.filter((p) => isTeamMemberRole(p.role)).length,
              active: scope.people.filter((p) => isTeamMemberRole(p.role) && p.isActive).length,
            },
      // Reviewers see what awaits their decision; employees see their own submissions still waiting.
      pendingReviews: this.store.tasks.filter(
        (t) =>
          t.reviewStatus === 'PENDING' && (user.role === 'EMPLOYEE' ? t.assigneeId === user.id : canReviewTask(actor, t)),
      ).length,
    };
  }

  attention(user: SeedUser, now: Date): DashboardAttention {
    const scope = this.resolveScope(user, {});
    const actor = this.store.actorFor(user);
    const open = scope.tasks.filter((t) => isOpenStatus(t.status));
    const top = (tasks: SeedTask[]) =>
      tasks
        .slice()
        .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
        .slice(0, 6)
        .map((t) => this.store.summarizeTask(t, actor, now));
    const soon = now.getTime() + 2 * DAY_MS;

    return {
      overdue: top(open.filter((t) => t.dueAt < now)),
      blocked: top(open.filter((t) => t.status === 'BLOCKED')),
      dueSoon: top(open.filter((t) => t.dueAt >= now && t.dueAt.getTime() < soon)),
      atRiskPeople:
        user.role === 'EMPLOYEE'
          ? []
          : this.livePeople(scope, now)
              .filter((p) => isRisky(p.risk))
              .sort(byRiskThenName)
              .slice(0, 6),
      atRiskTeams:
        user.role === 'SUPER_ADMIN'
          ? this.liveTeams(scope, now)
              .filter((t) => isRisky(t.risk))
              .sort(byRiskThenName)
              .slice(0, 6)
          : [],
      inactivePeople: user.role === 'SUPER_ADMIN' ? this.store.users.filter((u) => !u.isActive).length : null,
    };
  }

  /** Today is computed live; earlier days come from the immutable snapshots taken each night. */
  daily(user: SeedUser, query: DailyReportQuery, now: Date): DailyReport {
    const tz = this.store.timeZone;
    const today = dayKey(now, tz);
    const date = query.date ?? today;
    if (date > today) {
      throw new DomainError('VALIDATION_ERROR', 'Reports are not available for future dates.', {
        fieldErrors: { date: ['Choose today or an earlier date'] },
        formErrors: [],
      });
    }

    const scope = this.resolveScope(user, query);
    const isToday = date === today;
    const dayStart = startOfDay(date, tz);
    const dayEnd = startOfDay(addDays(date, 1), tz);
    const inDay = (d: Date) => d >= dayStart && d < dayEnd;
    const taskIds = new Set(scope.tasks.map((t) => t.id));
    const completions = this.store.activities
      .filter((a) => a.type === 'COMPLETED' && taskIds.has(a.taskId))
      .map((a) => a.createdAt);

    let people: PersonProgress[];
    let teams: TeamProgress[];
    let workload: WorkloadSummary;

    if (isToday) {
      people = this.livePeople(scope, now);
      teams = this.liveTeams(scope, now);
      workload = summarizeWorkload(scope.tasks, now, tz);
    } else {
      const snapshots = this.store.snapshots.filter((s) => s.date === date);
      const peopleIds = new Set(scope.people.map((p) => p.id));
      people = scope.people.map((p) => {
        const snapshot = snapshots.find((s) => s.userId === p.id);
        const team = this.store.currentTeam(p.id);
        return {
          user: this.store.userRef(p),
          team: team ? this.store.teamRef(team) : null,
          workload: snapshot ? sumSnapshots([snapshot]) : emptyWorkload(),
          completedToday: snapshot?.completedOnDay ?? 0,
          risk: snapshot?.risk ?? null,
        };
      });
      teams = scope.teams.map((team) => {
        const members = snapshots.filter((s) => s.teamId === team.id);
        const owner = team.ownerId ? this.store.findUser(team.ownerId) : undefined;
        return {
          team: this.store.teamRef(team),
          owner: owner ? this.store.userRef(owner) : null,
          memberCount: this.store.teamMembers(team.id).length,
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
        activeEmployees: scope.people.filter((p) => p.isActive && isTeamMemberRole(p.role)).length,
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
    };
  }

  progress(user: SeedUser, query: ProgressReportQuery, now: Date): ProgressReport {
    const tz = this.store.timeZone;
    const today = dayKey(now, tz);
    const scope = this.resolveScope(user, query);
    const days = dayRange(query.from, query.to > today ? today : query.to);
    const snapshots = this.store.snapshots;

    const point = (date: string, userIds: readonly string[]): ProgressPoint => {
      const workload =
        date === today
          ? summarizeWorkload(
              scope.tasks.filter((t) => userIds.includes(t.assigneeId)),
              now,
              tz,
            )
          : sumSnapshots(snapshots.filter((s) => s.date === date && userIds.includes(s.userId)));
      return { date, total: workload.total, completed: workload.completed, completionRate: workload.completionRate };
    };

    const rows = scope.people
      .map((p) => {
        const team = this.store.currentTeam(p.id);
        return {
          user: this.store.userRef(p),
          team: team ? this.store.teamRef(team) : null,
          points: days.map((d) => point(d, [p.id])),
        };
      })
      .filter((row) => row.points.some((pt) => pt.total > 0))
      .sort((a, b) => a.user.name.localeCompare(b.user.name));

    const everyone = scope.people.map((p) => p.id);
    return {
      from: query.from,
      to: days.at(-1) ?? query.from,
      days,
      scope: scope.info,
      totals: days.map((d) => point(d, everyone)),
      rows,
    };
  }

  activity(user: SeedUser, query: ActivityFeedQuery): ActivityFeedItem[] {
    const scope = this.resolveScope(user, query);
    const tz = this.store.timeZone;
    const titles = new Map(scope.tasks.map((t) => [t.id, t.title]));
    let events = this.store.activities.filter((a) => titles.has(a.taskId));
    if (query.date) {
      const start = startOfDay(query.date, tz);
      const end = startOfDay(addDays(query.date, 1), tz);
      events = events.filter((a) => a.createdAt >= start && a.createdAt < end);
    }
    return events
      .slice(-query.limit)
      .reverse()
      .map(
        (a): ActivityFeedItem => ({
          ...this.store.activityEntry(a),
          task: { id: a.taskId, title: titles.get(a.taskId)! },
        }),
      );
  }
}

@ApiTags('reports')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Headline numbers for the viewer’s scope' })
  summary(@CurrentUser() user: SeedUser, @Now() now: Date): DashboardSummary {
    return this.reports.summary(user, now);
  }

  @Get('attention')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Overdue, blocked and due-soon work, and who is at risk' })
  attention(@CurrentUser() user: SeedUser, @Now() now: Date): DashboardAttention {
    return this.reports.attention(user, now);
  }
}

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('daily')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Daily report — live for today, from snapshots for earlier days' })
  daily(
    @CurrentUser() user: SeedUser,
    @Query(zodPipe(dailyReportQuerySchema)) query: DailyReportQuery,
    @Now() now: Date,
  ): DailyReport {
    return this.reports.daily(user, query, now);
  }

  @Get('progress')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Completion over a date range, per person and in total' })
  progress(
    @CurrentUser() user: SeedUser,
    @Query(zodPipe(progressReportQuerySchema)) query: ProgressReportQuery,
    @Now() now: Date,
  ): ProgressReport {
    return this.reports.progress(user, query, now);
  }
}

@ApiTags('reports')
@Controller('activity')
export class ActivityController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermissions('tasks.read')
  @ApiOperation({ summary: 'Recent task activity within scope' })
  feed(
    @CurrentUser() user: SeedUser,
    @Query(zodPipe(activityFeedQuerySchema)) query: ActivityFeedQuery,
  ): ActivityFeedItem[] {
    return this.reports.activity(user, query);
  }
}

@Module({
  controllers: [DashboardController, ReportsController, ActivityController],
  providers: [ReportsService],
})
export class ReportsModule {}
