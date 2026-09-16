import type { TaskRecord } from '../domain/tasks.js';
import { summarizeWorkload, workloadRisk } from '../domain/workload.js';
import type {
  AuditAction,
  AuditResourceType,
  AuditResult,
  NotificationType,
  RiskLevel,
  SystemRole,
  TaskActivityType,
  TaskPriority,
  TaskStatus,
} from '../enums.js';
import { DAY_MS, addDays, dayKey, startOfDay, zonedTimeToUtc } from '../time.js';
import {
  ADMIN_TASKS,
  BLOCK_REASONS,
  COMMENT_PAIRS,
  COMPLETION_NOTES,
  DESCRIPTIONS,
  INACTIVE_EMPLOYEE,
  MOVED_EMPLOYEE,
  ORGANIZATION,
  SPRINT_AREAS,
  SPRINT_DAILY_COMPLETIONS,
  SPRINT_EMPLOYEES,
  SUPER_ADMIN,
  TEAMS,
  UNOWNED_TEAM,
} from './catalog.js';

/**
 * Deterministic demo organization (requirements §36): 1 Super Admin, 3 Admins, 10 employees per
 * admin, teams, tasks with a realistic history, comments, notifications, audit entries and daily
 * progress snapshots. Dates are relative to `now`. Used by the mock API and the database seed.
 */

/** Development-only password shared by every seeded account. Never used outside seed data. */
export const DEMO_PASSWORD = 'ZempDemo#2026';

export interface SeedUser {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
  isActive: boolean;
  jobTitle: string;
  employeeCode: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface SeedTeam {
  id: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeedMembership {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface SeedTask extends TaskRecord {
  completionNote: string | null;
  createdById: string;
  updatedById: string;
  updatedAt: Date;
}

export interface SeedActivity {
  id: string;
  taskId: string;
  actorId: string;
  type: TaskActivityType;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  createdAt: Date;
}

export interface SeedComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: Date;
}

export interface SeedNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  taskId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface SeedAuditLog {
  id: string;
  actorId: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  result: AuditResult;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface SeedSnapshot {
  id: string;
  date: string;
  userId: string;
  teamId: string | null;
  total: number;
  completed: number;
  todo: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  completedOnDay: number;
  assignedOnDay: number;
  risk: RiskLevel | null;
  createdAt: Date;
}

export interface SeedData {
  organization: { name: string; timezone: string };
  users: SeedUser[];
  teams: SeedTeam[];
  memberships: SeedMembership[];
  tasks: SeedTask[];
  activities: SeedActivity[];
  comments: SeedComment[];
  notifications: SeedNotification[];
  auditLogs: SeedAuditLog[];
  snapshots: SeedSnapshot[];
}

type Outcome = 'done' | 'open' | 'blocked' | 'todo' | 'cancelled';

const HOUR_MS = 3_600_000;
const SNAPSHOT_DAYS = 14;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139.0 Safari/537.36';

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function emailFor(name: string) {
  const local = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('.');
  return `${local}@zemp.test`;
}

export function generateSeed(options: { now?: Date; timeZone?: string } = {}): SeedData {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? ORGANIZATION.timezone;
  const rand = mulberry32(20260914);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
  const chance = (p: number) => rand() < p;
  const id = () => {
    const hex = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
    hex[12] = '4';
    hex[16] = (8 + Math.floor(rand() * 4)).toString(16);
    const s = hex.join('');
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  };

  const today = dayKey(now, timeZone);
  /** Wall-clock `time` on the day `offset` days from today, in the organization's time zone. */
  const at = (offset: number, time: string) => zonedTimeToUtc(addDays(today, offset), time, timeZone);
  /** Seeded history never happens in the future. */
  const past = (date: Date) => (date.getTime() >= now.getTime() ? new Date(now.getTime() - int(2, 40) * 60_000) : date);
  /** `base + ms`, but never later than now and never earlier than `base`. */
  const after = (base: Date, ms: number) =>
    new Date(Math.max(base.getTime(), Math.min(base.getTime() + ms, now.getTime() - 60_000)));
  const hhmm = (hour: number, minute = pick([0, 15, 30, 45])) =>
    `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const users: SeedUser[] = [];
  const teams: SeedTeam[] = [];
  const memberships: SeedMembership[] = [];
  const tasks: SeedTask[] = [];
  const activities: SeedActivity[] = [];
  const comments: SeedComment[] = [];
  const notifications: SeedNotification[] = [];
  const auditLogs: SeedAuditLog[] = [];

  const audit = (
    actorId: string | null,
    action: AuditAction,
    resourceType: AuditResourceType,
    resourceId: string | null,
    createdAt: Date,
    metadata: Record<string, unknown> | null = null,
    result: AuditResult = 'SUCCESS',
  ) =>
    auditLogs.push({ id: id(), actorId, action, resourceType, resourceId, result, metadata, ip: '10.20.4.18', userAgent: USER_AGENT, createdAt });

  const notify = (userId: string, type: NotificationType, title: string, body: string, taskId: string | null, createdAt: Date) =>
    notifications.push({ id: id(), userId, type, title, body, taskId, readAt: null, createdAt });

  let employeeNumber = 0;
  const addUser = (name: string, email: string, role: SystemRole, jobTitle: string, createdAt: Date): SeedUser => {
    const user: SeedUser = {
      id: id(),
      email,
      name,
      role,
      isActive: true,
      jobTitle,
      employeeCode: `ZMP-${String(++employeeNumber).padStart(4, '0')}`,
      createdAt,
      lastLoginAt: null,
    };
    users.push(user);
    return user;
  };

  // ── Organization, admins, teams, people ──────────────────────────────────
  const john = addUser(SUPER_ADMIN.name, SUPER_ADMIN.email, 'SUPER_ADMIN', SUPER_ADMIN.jobTitle, at(-45, '10:00'));
  audit(john.id, 'SETTINGS_UPDATED', 'ORGANIZATION', null, at(-45, '10:20'), { timezone: timeZone, name: ORGANIZATION.name });

  const teamOf = new Map<string, SeedTeam>();
  const membersOf = new Map<string, SeedUser[]>();
  const adminOf = new Map<string, SeedUser>();
  const titlesOf = new Map<string, readonly string[]>();

  TEAMS.forEach((definition, index) => {
    const createdAt = at(-44, hhmm(10 + index, 0));
    const admin = addUser(definition.admin.name, definition.admin.email, 'ADMIN', definition.admin.jobTitle, createdAt);
    audit(john.id, 'USER_CREATED', 'USER', admin.id, createdAt, { role: 'ADMIN', name: admin.name });
    const team: SeedTeam = {
      id: id(),
      name: definition.name,
      description: definition.description,
      ownerId: admin.id,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    };
    teams.push(team);
    audit(john.id, 'TEAM_CREATED', 'TEAM', team.id, createdAt, { name: team.name, ownerId: admin.id });
    adminOf.set(team.id, admin);
    titlesOf.set(team.id, definition.tasks);
    membersOf.set(team.id, []);
    for (const [name, jobTitle] of definition.members) {
      const joinedAt = at(-43 + int(0, 2), hhmm(11 + int(0, 4)));
      const user = addUser(name, emailFor(name), 'EMPLOYEE', jobTitle, joinedAt);
      audit(john.id, 'USER_CREATED', 'USER', user.id, joinedAt, { role: 'EMPLOYEE', name, teamId: team.id });
      memberships.push({ id: id(), teamId: team.id, userId: user.id, joinedAt, leftAt: null });
      teamOf.set(user.id, team);
      membersOf.get(team.id)!.push(user);
    }
  });

  const byName = (name: string) => users.find((u) => u.name === name)!;
  const [engineering, marketing] = teams as [SeedTeam, SeedTeam, SeedTeam];

  // Zara joined Marketing and moved to Product Engineering ten days ago.
  const zara = byName(MOVED_EMPLOYEE);
  const zaraMembership = memberships.find((m) => m.userId === zara.id)!;
  const movedAt = at(-10, '09:30');
  memberships.push({ id: id(), teamId: marketing.id, userId: zara.id, joinedAt: zaraMembership.joinedAt, leftAt: movedAt });
  zaraMembership.joinedAt = movedAt;
  audit(john.id, 'TEAM_MEMBER_MOVED', 'USER', zara.id, movedAt, { fromTeamId: marketing.id, toTeamId: engineering.id });

  const designStudio: SeedTeam = {
    id: id(),
    name: UNOWNED_TEAM.name,
    description: UNOWNED_TEAM.description,
    ownerId: null,
    isActive: true,
    createdAt: at(-2, '15:00'),
    updatedAt: at(-2, '15:00'),
  };
  teams.push(designStudio);
  audit(john.id, 'TEAM_CREATED', 'TEAM', designStudio.id, designStudio.createdAt, { name: designStudio.name, ownerId: null });

  // ── Tasks with history ───────────────────────────────────────────────────
  const log = (task: SeedTask, actorId: string, type: TaskActivityType, createdAt: Date, fromValue: string | null = null, toValue: string | null = null, note: string | null = null) => {
    activities.push({ id: id(), taskId: task.id, actorId, type, fromValue, toValue, note, createdAt });
    task.updatedAt = createdAt;
    task.updatedById = actorId;
  };

  const priority = (): TaskPriority => {
    const r = rand();
    return r < 0.2 ? 'LOW' : r < 0.65 ? 'MEDIUM' : r < 0.9 ? 'HIGH' : 'URGENT';
  };

  interface TaskPlanInput {
    title: string;
    assignee: SeedUser;
    assignor: SeedUser;
    teamId: string | null;
    createdAt: Date;
    dueAt: Date;
    outcome: Outcome;
    completedAt?: Date;
    progress?: number;
  }

  const createTask = (p: TaskPlanInput): SeedTask => {
    const task: SeedTask = {
      id: id(),
      title: p.title,
      description: chance(0.6) ? pick(DESCRIPTIONS) : null,
      status: 'TODO',
      priority: priority(),
      progress: 0,
      assigneeId: p.assignee.id,
      assignorId: p.assignor.id,
      teamId: p.teamId,
      startAt: p.createdAt,
      dueAt: p.dueAt,
      completedAt: null,
      createdAt: p.createdAt,
      completionNote: null,
      createdById: p.assignor.id,
      updatedById: p.assignor.id,
      updatedAt: p.createdAt,
    };
    tasks.push(task);
    log(task, p.assignor.id, 'CREATED', p.createdAt);
    log(task, p.assignor.id, 'ASSIGNED', p.createdAt, null, p.assignee.id);
    audit(p.assignor.id, 'TASK_ASSIGNED', 'TASK', task.id, p.createdAt, { assigneeId: p.assignee.id, teamId: p.teamId, dueAt: p.dueAt.toISOString() });
    notify(p.assignee.id, 'TASK_ASSIGNED', 'Task assigned to you', `${p.assignor.name} assigned "${task.title}" to you.`, task.id, p.createdAt);
    if (p.outcome === 'todo') return task;

    // Every event lands between creation and now; some finished work lands after its deadline.
    const late = p.outcome === 'done' && !p.completedAt && chance(0.15) ? 0.8 * DAY_MS : 0;
    const end = Math.min(now.getTime() - 60_000, (p.completedAt?.getTime() ?? p.dueAt.getTime()) + late);
    const span = Math.max(end - p.createdAt.getTime(), 0);
    const moment = (fraction: number) => new Date(p.createdAt.getTime() + span * fraction);
    const setProgress = (value: number, when: Date) => {
      if (value === task.progress) return;
      log(task, p.assignee.id, 'PROGRESS_CHANGED', when, String(task.progress), String(value));
      task.progress = value;
    };

    log(task, p.assignee.id, 'STATUS_CHANGED', moment(0.1), 'TODO', 'IN_PROGRESS');
    task.status = 'IN_PROGRESS';

    if (p.outcome === 'cancelled') {
      setProgress(int(10, 40), moment(0.3));
      const cancelledAt = moment(0.5);
      log(task, p.assignor.id, 'CANCELLED', cancelledAt, 'IN_PROGRESS', 'CANCELLED', 'No longer needed');
      audit(p.assignor.id, 'TASK_CANCELLED', 'TASK', task.id, cancelledAt, { from: 'IN_PROGRESS', note: 'No longer needed' });
      notify(p.assignee.id, 'TASK_CANCELLED', 'Task cancelled', `${p.assignor.name} cancelled "${task.title}".`, task.id, cancelledAt);
      task.status = 'CANCELLED';
      return task;
    }

    if (p.outcome === 'done') {
      setProgress(int(25, 55), moment(0.45));
      const completedAt = p.completedAt ?? moment(0.9);
      log(task, p.assignee.id, 'PROGRESS_CHANGED', completedAt, String(task.progress), '100');
      const note = chance(0.3) ? pick(COMPLETION_NOTES) : null;
      log(task, p.assignee.id, 'COMPLETED', completedAt, 'IN_PROGRESS', 'COMPLETED', note);
      notify(p.assignor.id, 'TASK_COMPLETED', 'Task completed', `${p.assignee.name} completed "${task.title}".`, task.id, completedAt);
      task.status = 'COMPLETED';
      task.progress = 100;
      task.completedAt = completedAt;
      task.completionNote = note;
      return task;
    }

    setProgress(p.progress ?? int(15, 85), moment(0.5));
    if (p.outcome === 'blocked') {
      const blockedAt = moment(0.7);
      const reason = pick(BLOCK_REASONS);
      log(task, p.assignee.id, 'STATUS_CHANGED', blockedAt, 'IN_PROGRESS', 'BLOCKED', reason);
      notify(p.assignor.id, 'TASK_BLOCKED', 'Task blocked', `${p.assignee.name} marked "${task.title}" as blocked: ${reason}`, task.id, blockedAt);
      task.status = 'BLOCKED';
    }
    return task;
  };

  const outcomeFor = (dueAt: Date): Outcome => {
    const r = rand();
    if (dueAt < now) return r < 0.74 ? 'done' : r < 0.86 ? 'open' : r < 0.93 ? 'blocked' : r < 0.97 ? 'todo' : 'cancelled';
    return r < 0.28 ? 'done' : r < 0.7 ? 'open' : r < 0.8 ? 'blocked' : r < 0.97 ? 'todo' : 'cancelled';
  };

  const regularTasks = (assignee: SeedUser, team: SeedTeam, count: number, earliestDay = -14, latestDay = 0) => {
    const admin = adminOf.get(team.id)!;
    const titles = titlesOf.get(team.id)!;
    for (let i = 0; i < count; i++) {
      const createdDay = int(earliestDay, latestDay);
      const createdAt = past(at(createdDay, hhmm(int(9, 16))));
      const dueAt = zonedTimeToUtc(addDays(dayKey(createdAt, timeZone), int(1, 8)), '18:00', timeZone);
      createTask({ title: pick(titles), assignee, assignor: admin, teamId: team.id, createdAt, dueAt, outcome: outcomeFor(dueAt) });
    }
  };

  // The requirements §10 sprint: 30 tasks each for three engineers, five days to finish.
  const rock = adminOf.get(engineering.id)!;
  const sprintStart = at(-3, '09:00');
  const sprintDue = at(2, '18:00');
  SPRINT_EMPLOYEES.forEach((name, person) => {
    const assignee = byName(name);
    const schedule = SPRINT_DAILY_COMPLETIONS[person]!;
    let n = 0;
    schedule.forEach((count, day) => {
      for (let i = 0; i < count; i++) {
        n++;
        const completedAt = at(day - 3, hhmm(10 + Math.floor((i * 8) / Math.max(count, 1))));
        createTask({
          title: `Regression check ${String(n).padStart(2, '0')}: ${SPRINT_AREAS[n % SPRINT_AREAS.length]}`,
          assignee,
          assignor: rock,
          teamId: engineering.id,
          createdAt: sprintStart,
          dueAt: sprintDue,
          outcome: completedAt < now ? 'done' : 'open',
          completedAt,
        });
      }
    });
    while (n < 30) {
      n++;
      createTask({
        title: `Regression check ${String(n).padStart(2, '0')}: ${SPRINT_AREAS[n % SPRINT_AREAS.length]}`,
        assignee,
        assignor: rock,
        teamId: engineering.id,
        createdAt: sprintStart,
        dueAt: sprintDue,
        outcome: chance(0.35) ? 'open' : 'todo',
        progress: int(10, 60),
      });
    }
  });

  const liam = byName(INACTIVE_EMPLOYEE);
  for (const team of teams) {
    for (const member of membersOf.get(team.id) ?? []) {
      if (SPRINT_EMPLOYEES.includes(member.name as (typeof SPRINT_EMPLOYEES)[number])) regularTasks(member, team, 2, -6, 0);
      else if (member.id === zara.id) regularTasks(member, team, int(5, 7), -9, 0);
      else if (member.id === liam.id) regularTasks(member, team, 6, -14, -6);
      else regularTasks(member, team, int(6, 10));
    }
  }

  // Work assigned by the Super Admin to each admin.
  for (const team of teams.filter((t) => t.ownerId)) {
    const admin = adminOf.get(team.id)!;
    for (let i = 0; i < 3; i++) {
      const createdAt = past(at(-int(1, 12), hhmm(int(10, 15))));
      const dueAt = zonedTimeToUtc(addDays(dayKey(createdAt, timeZone), int(3, 10)), '18:00', timeZone);
      createTask({ title: ADMIN_TASKS[(i + teams.indexOf(team)) % ADMIN_TASKS.length]!, assignee: admin, assignor: john, teamId: team.id, createdAt, dueAt, outcome: outcomeFor(dueAt) });
    }
  }

  // Liam was deactivated with two tasks still open.
  const deactivatedAt = at(-5, '16:00');
  liam.isActive = false;
  audit(john.id, 'USER_DEACTIVATED', 'USER', liam.id, deactivatedAt, { reason: 'Left the company' });

  // A few early reassignments inside each team.
  for (const team of teams.filter((t) => t.ownerId)) {
    const members = membersOf.get(team.id)!.filter((m) => m.isActive);
    const candidates = tasks.filter((t) => t.teamId === team.id && t.status !== 'CANCELLED' && t.assignorId !== john.id && !t.title.startsWith('Regression'));
    for (let i = 0; i < 2 && candidates.length; i++) {
      const task = candidates.splice(Math.floor(rand() * candidates.length), 1)[0]!;
      const previous = pick(members.filter((m) => m.id !== task.assigneeId));
      const reassignedAt = after(task.createdAt, 20 * 60_000);
      const admin = adminOf.get(team.id)!;
      activities.push({ id: id(), taskId: task.id, actorId: admin.id, type: 'REASSIGNED', fromValue: previous.id, toValue: task.assigneeId, note: null, createdAt: reassignedAt });
      audit(admin.id, 'TASK_REASSIGNED', 'TASK', task.id, reassignedAt, { from: previous.id, to: task.assigneeId, teamId: team.id });
    }
  }

  // ── Comments ─────────────────────────────────────────────────────────────
  const userById = new Map(users.map((u) => [u.id, u]));
  for (const task of tasks) {
    if (task.status === 'TODO' || !chance(0.22)) continue;
    const [first, reply] = pick(COMMENT_PAIRS);
    const assignee = userById.get(task.assigneeId)!;
    const assignor = userById.get(task.assignorId)!;
    const firstAt = after(task.createdAt, int(2, 20) * HOUR_MS);
    const commentsToAdd: Array<[SeedUser, SeedUser, string, Date]> = [[assignee, assignor, first, firstAt]];
    if (chance(0.6)) commentsToAdd.push([assignor, assignee, reply, after(firstAt, int(1, 5) * HOUR_MS)]);
    for (const [author, recipient, body, createdAt] of commentsToAdd) {
      comments.push({ id: id(), taskId: task.id, authorId: author.id, body, createdAt });
      activities.push({ id: id(), taskId: task.id, actorId: author.id, type: 'COMMENT_ADDED', fromValue: null, toValue: null, note: null, createdAt });
      notify(recipient.id, 'COMMENT_ADDED', 'New comment', `${author.name} commented on "${task.title}".`, task.id, createdAt);
    }
  }

  // ── Deadline reminders ───────────────────────────────────────────────────
  for (const task of tasks) {
    if (task.status !== 'TODO' && task.status !== 'IN_PROGRESS' && task.status !== 'BLOCKED') continue;
    const untilDue = task.dueAt.getTime() - now.getTime();
    if (untilDue < 0) {
      notify(task.assigneeId, 'TASK_OVERDUE', 'Task overdue', `"${task.title}" is past its due date.`, task.id, after(task.dueAt, 5 * 60_000));
    } else if (untilDue < DAY_MS) {
      const reminderAt = after(task.createdAt, Math.max(task.dueAt.getTime() - DAY_MS - task.createdAt.getTime(), 0));
      notify(task.assigneeId, 'DEADLINE_APPROACHING', 'Due within 24 hours', `"${task.title}" is due soon.`, task.id, reminderAt);
    }
  }

  // ── Sign-ins ─────────────────────────────────────────────────────────────
  for (const user of users) {
    if (!user.isActive) continue;
    user.lastLoginAt = new Date(now.getTime() - int(1, 60) * HOUR_MS);
    audit(user.id, 'AUTH_LOGIN', 'SESSION', null, user.lastLoginAt);
  }
  audit(null, 'AUTH_LOGIN_FAILED', 'SESSION', null, at(-1, '08:42'), { email: 'rock@zemp.test', reason: 'INVALID_CREDENTIALS' }, 'FAILURE');
  audit(null, 'AUTH_LOGIN_FAILED', 'SESSION', null, at(-1, '08:43'), { email: 'rock@zemp.test', reason: 'INVALID_CREDENTIALS' }, 'FAILURE');

  // Older notifications have been read; keep each inbox to its latest 40.
  notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const perUser = new Map<string, number>();
  const keptNotifications = notifications.filter((n) => {
    const count = (perUser.get(n.userId) ?? 0) + 1;
    perUser.set(n.userId, count);
    if (now.getTime() - n.createdAt.getTime() > 2 * DAY_MS) n.readAt = new Date(n.createdAt.getTime() + 2 * HOUR_MS);
    return count <= 40;
  });

  return {
    organization: { name: ORGANIZATION.name, timezone: timeZone },
    users,
    teams,
    memberships,
    tasks,
    activities: activities.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    comments: comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    notifications: keptNotifications,
    auditLogs: auditLogs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    snapshots: buildSnapshots({ now, timeZone, users, tasks, activities, memberships, id }),
  };
}

/** Replays each task's immutable activity to reconstruct end-of-day state for the last 14 days. */
function buildSnapshots(args: {
  now: Date;
  timeZone: string;
  users: SeedUser[];
  tasks: SeedTask[];
  activities: SeedActivity[];
  memberships: SeedMembership[];
  id: () => string;
}): SeedSnapshot[] {
  const { now, timeZone, users, tasks, activities, memberships, id } = args;
  const eventsByTask = new Map<string, SeedActivity[]>();
  for (const event of activities) {
    const list = eventsByTask.get(event.taskId) ?? [];
    list.push(event);
    eventsByTask.set(event.taskId, list);
  }

  const stateAt = (task: SeedTask, at: Date) => {
    let status: TaskStatus = 'TODO';
    let progress = 0;
    let completedAt: Date | null = null;
    for (const event of eventsByTask.get(task.id) ?? []) {
      if (event.createdAt > at) break;
      if (event.type === 'PROGRESS_CHANGED') progress = Number(event.toValue);
      if (event.toValue && ['STATUS_CHANGED', 'COMPLETED', 'CANCELLED', 'REOPENED'].includes(event.type)) {
        status = event.toValue as TaskStatus;
        completedAt = status === 'COMPLETED' ? event.createdAt : null;
      }
    }
    return { status, progress, completedAt, dueAt: task.dueAt, startAt: task.startAt, createdAt: task.createdAt };
  };

  const snapshots: SeedSnapshot[] = [];
  const today = dayKey(now, timeZone);
  for (let offset = SNAPSHOT_DAYS - 1; offset >= 0; offset--) {
    const date = addDays(today, -offset);
    const dayStart = startOfDay(date, timeZone);
    const dayEnd = startOfDay(addDays(date, 1), timeZone);
    const at = offset === 0 ? now : new Date(dayEnd.getTime() - 1);
    for (const user of users) {
      const own = tasks.filter((t) => t.assigneeId === user.id && t.createdAt <= at);
      if (own.length === 0) continue;
      const states = own.map((t) => stateAt(t, at));
      const summary = summarizeWorkload(states, at, timeZone);
      const membership = memberships.find((m) => m.userId === user.id && m.joinedAt <= at && (!m.leftAt || m.leftAt > at));
      snapshots.push({
        id: id(),
        date,
        userId: user.id,
        teamId: membership?.teamId ?? null,
        total: summary.total,
        completed: summary.completed,
        todo: summary.todo,
        inProgress: summary.inProgress,
        blocked: summary.blocked,
        overdue: summary.overdue,
        completedOnDay: states.filter((s) => s.completedAt && s.completedAt >= dayStart && s.completedAt < dayEnd).length,
        assignedOnDay: own.filter((t) => t.createdAt >= dayStart && t.createdAt < dayEnd).length,
        risk: workloadRisk(states, at, timeZone),
        createdAt: at,
      });
    }
  }
  return snapshots;
}
