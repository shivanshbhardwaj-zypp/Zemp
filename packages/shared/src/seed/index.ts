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
  DEMO_TEAM,
  DESCRIPTIONS,
  ORGANIZATION,
  PEOPLE,
  SELF_REPORTS,
  TEAM_TASKS,
  type SeedPerson,
} from './catalog.js';

/**
 * Deterministic demo organization, seeded from the customer's Demo_Data sheet: the CXO team with its
 * Super Admins, admin and employees, plus tasks with a realistic history, comments, notifications,
 * audit entries and daily progress snapshots so the dashboards and reports have something to show.
 * Dates are relative to `now`. Used by the mock API and the database seed.
 */

/**
 * Development-only password shared by every seeded account, as given in the sheet. Seed data only —
 * it does not satisfy the app's own password rule, so changing it in-app requires a stronger one.
 */
export const DEMO_PASSWORD = '1234567890';

export interface SeedUser {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
  isActive: boolean;
  jobTitle: string;
  employeeCode: string;
  phone: string | null;
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

  const addUser = (definition: SeedPerson, createdAt: Date): SeedUser => {
    const user: SeedUser = {
      id: id(),
      email: definition.email,
      name: definition.name,
      role: definition.role,
      isActive: true,
      jobTitle: definition.jobTitle,
      employeeCode: definition.employeeCode,
      phone: definition.phone,
      createdAt,
      lastLoginAt: null,
    };
    users.push(user);
    return user;
  };

  // ── Organization, people and the one team ────────────────────────────────
  const person = new Map<string, SeedUser>();
  let createdAt = at(-45, '10:00');
  for (const definition of PEOPLE) {
    createdAt = new Date(createdAt.getTime() + 20 * 60_000);
    person.set(definition.name, addUser(definition, createdAt));
  }
  const owner = PEOPLE.find((p) => p.ownsTeam);
  const platformAdmin = person.get(PEOPLE[0]!.name)!;
  const teamAdmin = person.get(owner!.name)!;
  audit(platformAdmin.id, 'SETTINGS_UPDATED', 'ORGANIZATION', null, at(-45, '10:20'), {
    timezone: timeZone,
    name: ORGANIZATION.name,
  });
  for (const definition of PEOPLE.slice(1)) {
    const user = person.get(definition.name)!;
    audit(platformAdmin.id, 'USER_CREATED', 'USER', user.id, user.createdAt, { role: definition.role, name: user.name });
  }

  const teamCreatedAt = at(-44, '10:00');
  const team: SeedTeam = {
    id: id(),
    name: DEMO_TEAM.name,
    description: DEMO_TEAM.description,
    ownerId: teamAdmin.id,
    isActive: true,
    createdAt: teamCreatedAt,
    updatedAt: teamCreatedAt,
  };
  teams.push(team);
  audit(platformAdmin.id, 'TEAM_CREATED', 'TEAM', team.id, teamCreatedAt, { name: team.name, ownerId: teamAdmin.id });

  const members: SeedUser[] = [];
  for (const definition of PEOPLE.filter((p) => p.inTeam)) {
    const user = person.get(definition.name)!;
    const joinedAt = new Date(Math.max(teamCreatedAt.getTime(), user.createdAt.getTime()) + 30 * 60_000);
    memberships.push({ id: id(), teamId: team.id, userId: user.id, joinedAt, leftAt: null });
    members.push(user);
  }
  /** The people the team's work is assigned to — its employees and any sub admins. */
  const staff = PEOPLE.filter((p) => p.inTeam && p.role === 'EMPLOYEE').map((p) => person.get(p.name)!);

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
      origin: 'ASSIGNED',
      reviewerId: null,
      reviewStatus: null,
      reviewedAt: null,
      reviewNote: null,
      evidenceUrl: null,
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

  // Day-to-day work the team admin assigns to the team.
  let titleIndex = 0;
  for (const assignee of staff) {
    for (let i = 0; i < 9; i++) {
      const createdDay = int(-14, 0);
      const startedAt = past(at(createdDay, hhmm(int(9, 16))));
      const dueAt = zonedTimeToUtc(addDays(dayKey(startedAt, timeZone), int(1, 8)), '18:00', timeZone);
      createTask({
        title: TEAM_TASKS[titleIndex++ % TEAM_TASKS.length]!,
        assignee,
        assignor: teamAdmin,
        teamId: team.id,
        createdAt: startedAt,
        dueAt,
        outcome: outcomeFor(dueAt),
      });
    }
  }

  // Work the Super Admin assigns to the team's admin.
  for (let i = 0; i < 4; i++) {
    const startedAt = past(at(-int(1, 12), hhmm(int(10, 15))));
    const dueAt = zonedTimeToUtc(addDays(dayKey(startedAt, timeZone), int(3, 10)), '18:00', timeZone);
    createTask({
      title: ADMIN_TASKS[i % ADMIN_TASKS.length]!,
      assignee: teamAdmin,
      assignor: platformAdmin,
      teamId: team.id,
      createdAt: startedAt,
      dueAt,
      outcome: outcomeFor(dueAt),
    });
  }

  // A couple of reassignments inside the team, so the history is not uniform.
  if (staff.length > 1) {
    const candidates = tasks.filter((t) => t.status !== 'CANCELLED' && t.assignorId === teamAdmin.id);
    for (let i = 0; i < 2 && candidates.length; i++) {
      const task = candidates.splice(Math.floor(rand() * candidates.length), 1)[0]!;
      const previous = pick(staff.filter((m) => m.id !== task.assigneeId));
      const reassignedAt = after(task.createdAt, 20 * 60_000);
      activities.push({ id: id(), taskId: task.id, actorId: teamAdmin.id, type: 'REASSIGNED', fromValue: previous.id, toValue: task.assigneeId, note: null, createdAt: reassignedAt });
      audit(teamAdmin.id, 'TASK_REASSIGNED', 'TASK', task.id, reassignedAt, { from: previous.id, to: task.assigneeId, teamId: team.id });
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

  // ── Self-reported work (employee-logged, awaiting or past review) ────────
  const selfReport = (p: {
    author: SeedUser;
    reviewer: SeedUser;
    title: string;
    description: string;
    evidenceUrl: string | null;
    completedAt: Date;
    decision?: { approved: boolean; note: string | null };
  }) => {
    const submittedAt = after(p.completedAt, int(20, 90) * 60_000);
    const authorTeam = memberships.find((m) => m.userId === p.author.id && !m.leftAt);
    const task: SeedTask = {
      id: id(),
      title: p.title,
      description: p.description,
      status: 'COMPLETED',
      priority: 'MEDIUM',
      progress: 100,
      assigneeId: p.author.id,
      assignorId: p.author.id,
      teamId: team?.id ?? null,
      startAt: null,
      dueAt: p.completedAt,
      completedAt: p.completedAt,
      createdAt: submittedAt,
      origin: 'SELF_REPORTED',
      reviewerId: p.reviewer.id,
      reviewStatus: 'PENDING',
      reviewedAt: null,
      reviewNote: null,
      evidenceUrl: p.evidenceUrl,
      completionNote: null,
      createdById: p.author.id,
      updatedById: p.author.id,
      updatedAt: submittedAt,
    };
    tasks.push(task);
    log(task, p.author.id, 'CREATED', submittedAt);
    log(task, p.author.id, 'SUBMITTED_FOR_REVIEW', submittedAt, null, p.reviewer.id);
    audit(p.author.id, 'TASK_SELF_REPORTED', 'TASK', task.id, submittedAt, {
      reviewerId: p.reviewer.id,
      completedAt: p.completedAt.toISOString(),
    });
    notify(
      p.reviewer.id,
      'REVIEW_REQUESTED',
      'Work submitted for review',
      `${p.author.name} logged "${task.title}" and asked you to review it.`,
      task.id,
      submittedAt,
    );
    if (p.decision) {
      const decidedAt = after(submittedAt, int(2, 20) * HOUR_MS);
      const { approved, note } = p.decision;
      task.reviewStatus = approved ? 'APPROVED' : 'CHANGES_REQUESTED';
      task.reviewedAt = decidedAt;
      task.reviewNote = note;
      log(task, p.reviewer.id, approved ? 'REVIEW_APPROVED' : 'REVIEW_CHANGES_REQUESTED', decidedAt, 'PENDING', task.reviewStatus, note);
      audit(p.reviewer.id, approved ? 'TASK_REVIEW_APPROVED' : 'TASK_REVIEW_CHANGES_REQUESTED', 'TASK', task.id, decidedAt, {
        authorId: p.author.id,
        note,
      });
      notify(
        p.author.id,
        approved ? 'REVIEW_APPROVED' : 'REVIEW_CHANGES_REQUESTED',
        approved ? 'Work approved' : 'Changes requested',
        approved
          ? `${p.reviewer.name} approved "${task.title}".`
          : `${p.reviewer.name} asked for changes on "${task.title}": ${note}`,
        task.id,
        decidedAt,
      );
    }
    return task;
  };

  for (const [index, sample] of SELF_REPORTS.entries()) {
    const author = staff[index % staff.length];
    if (!author) continue;
    // Alternate between the team admin and the Super Admin, so both review queues have work.
    const reviewer = sample.toSuperAdmin ? platformAdmin : teamAdmin;
    selfReport({
      author,
      reviewer,
      title: sample.title,
      description: sample.description,
      evidenceUrl: sample.evidenceUrl,
      completedAt: at(sample.dayOffset, sample.time),
      decision: sample.decision,
    });
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
    // Self-reported work has no status history: it is logged complete, at the time it was done.
    if (task.origin === 'SELF_REPORTED' && task.completedAt && task.completedAt <= at) {
      status = 'COMPLETED';
      progress = 100;
      completedAt = task.completedAt;
    }
    return {
      status,
      progress,
      completedAt,
      dueAt: task.dueAt,
      startAt: task.startAt,
      createdAt: task.createdAt,
      origin: task.origin,
      reviewStatus: task.reviewStatus,
    };
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
