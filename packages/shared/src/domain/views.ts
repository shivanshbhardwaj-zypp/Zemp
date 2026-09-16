import type {
  DailyTrendPoint,
  PersonProgress,
  TaskSummary,
  TeamProgress,
  TeamRef,
  UserRef,
} from '../contracts.js';
import {
  REVIEW_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type AuditAction,
  type ReviewStatus,
  type RiskLevel,
  type TaskActivityType,
  type TaskPriority,
  type TaskStatus,
} from '../enums.js';
import { addDays, dayKey, startOfDay } from '../time.js';
import type { Actor } from './access.js';
import { allowedTransitions, deadlineState, isOverdue, taskPermissions, taskRisk, type TaskRecord } from './tasks.js';
import { summarizeWorkload, workloadRisk, type WorkloadTask } from './workload.js';

/**
 * Read-model builders shared by every API implementation, so overdue state, risk, permissions and
 * report maths are computed in exactly one place.
 */

export const RISK_SEVERITY: Record<RiskLevel, number> = {
  OVERDUE: 3,
  AT_RISK: 2,
  ON_TRACK: 1,
  COMPLETED: 0,
};

export function toTaskSummary(args: {
  task: TaskRecord & { updatedAt: Date };
  actor: Actor;
  assignee: UserRef;
  assignor: UserRef;
  team: TeamRef | null;
  /** The chosen reviewer of self-reported work, when there is one. */
  reviewer?: UserRef | null;
  now: Date;
  timeZone: string;
}): TaskSummary {
  const { task, actor, now, timeZone } = args;
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    progress: task.progress,
    startAt: task.startAt?.toISOString() ?? null,
    dueAt: task.dueAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    assignee: args.assignee,
    assignor: args.assignor,
    team: args.team,
    isOverdue: isOverdue(task, now),
    deadlineState: deadlineState(task, now, timeZone),
    risk: taskRisk(task, now),
    allowedTransitions: allowedTransitions(actor, task),
    permissions: taskPermissions(actor, task),
    origin: task.origin,
    evidenceUrl: task.evidenceUrl,
    review:
      task.reviewStatus === null
        ? null
        : {
            status: task.reviewStatus,
            reviewer: args.reviewer ?? null,
            reviewedAt: task.reviewedAt?.toISOString() ?? null,
            note: task.reviewNote,
          },
  };
}

/** Bounds of the organization-local calendar day containing `at`. */
export function dayBounds(at: Date, timeZone: string) {
  const key = dayKey(at, timeZone);
  return { key, start: startOfDay(key, timeZone), end: startOfDay(addDays(key, 1), timeZone) };
}

export function countInDay(dates: readonly (Date | null)[], at: Date, timeZone: string): number {
  const { start, end } = dayBounds(at, timeZone);
  return dates.filter((d) => d !== null && d >= start && d < end).length;
}

const completedToday = (tasks: readonly WorkloadTask[], now: Date, timeZone: string) =>
  countInDay(tasks.map((t) => (t.status === 'COMPLETED' ? t.completedAt : null)), now, timeZone);

export function toPersonProgress(args: {
  user: UserRef;
  team: TeamRef | null;
  tasks: readonly WorkloadTask[];
  now: Date;
  timeZone: string;
}): PersonProgress {
  const { tasks, now, timeZone } = args;
  return {
    user: args.user,
    team: args.team,
    workload: summarizeWorkload(tasks, now, timeZone),
    completedToday: completedToday(tasks, now, timeZone),
    risk: workloadRisk(tasks, now, timeZone),
  };
}

export function toTeamProgress(args: {
  team: TeamRef;
  owner: UserRef | null;
  memberCount: number;
  tasks: readonly WorkloadTask[];
  now: Date;
  timeZone: string;
}): TeamProgress {
  const { tasks, now, timeZone } = args;
  return {
    team: args.team,
    owner: args.owner,
    memberCount: args.memberCount,
    workload: summarizeWorkload(tasks, now, timeZone),
    completedToday: completedToday(tasks, now, timeZone),
    risk: workloadRisk(tasks, now, timeZone),
  };
}

/** Assigned and completed counts per organization-local day, oldest first, ending on `endKey`. */
export function dailyTrend(args: {
  assignments: readonly Date[];
  completions: readonly Date[];
  endKey: string;
  days: number;
  timeZone: string;
}): DailyTrendPoint[] {
  const { assignments, completions, endKey, days, timeZone } = args;
  return Array.from({ length: days }, (_, i) => {
    const key = addDays(endKey, i - days + 1);
    const start = startOfDay(key, timeZone);
    const end = startOfDay(addDays(key, 1), timeZone);
    const inDay = (d: Date) => d >= start && d < end;
    return { date: key, assigned: assignments.filter(inDay).length, completed: completions.filter(inDay).length };
  });
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

/** `Sep 18, 2026, 6:00 PM` in the organization time zone (Frontend.md §108). */
export function formatDateTime(date: Date, timeZone: string): string {
  let f = dateTimeFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'medium', timeStyle: 'short' });
    dateTimeFormatters.set(timeZone, f);
  }
  return f.format(date);
}

export interface NameLookups {
  user: (id: string) => string | undefined;
  team?: (id: string) => string | undefined;
  task?: (id: string) => string | undefined;
}

/** Human-readable before/after values for a task activity entry. */
export function activityLabels(
  event: { type: TaskActivityType; fromValue: string | null; toValue: string | null },
  lookups: NameLookups,
  timeZone: string,
): { fromLabel: string | null; toLabel: string | null } {
  const label = (value: string | null): string | null => {
    if (value === null) return null;
    switch (event.type) {
      case 'ASSIGNED':
      case 'REASSIGNED':
        return lookups.user(value) ?? 'Unknown person';
      case 'SUBMITTED_FOR_REVIEW':
        return lookups.user(value) ?? REVIEW_STATUS_LABELS[value as ReviewStatus] ?? value;
      case 'REVIEW_APPROVED':
      case 'REVIEW_CHANGES_REQUESTED':
        return REVIEW_STATUS_LABELS[value as ReviewStatus] ?? value;
      case 'STATUS_CHANGED':
      case 'COMPLETED':
      case 'CANCELLED':
      case 'REOPENED':
        return TASK_STATUS_LABELS[value as TaskStatus] ?? value;
      case 'PRIORITY_CHANGED':
        return TASK_PRIORITY_LABELS[value as TaskPriority] ?? value;
      case 'PROGRESS_CHANGED':
        return `${value}%`;
      case 'DUE_DATE_CHANGED':
        return formatDateTime(new Date(value), timeZone);
      default:
        return value;
    }
  };
  return { fromLabel: label(event.fromValue), toLabel: label(event.toValue) };
}

/** One-line audit description, e.g. `Reassigned "Homepage audit" · Aarav Shah → Priya Nair`. */
export function auditSummary(
  entry: { action: AuditAction; resourceId: string | null; metadata: Record<string, unknown> | null },
  lookups: NameLookups,
): string {
  const meta = entry.metadata ?? {};
  const text = (key: string) => (typeof meta[key] === 'string' ? (meta[key] as string) : undefined);
  const person = (id: string | null | undefined) => (id ? lookups.user(id) : undefined) ?? 'a person';
  const team = (id: string | null | undefined) => (id ? lookups.team?.(id) : undefined) ?? 'a team';
  const task = () => `"${(entry.resourceId ? lookups.task?.(entry.resourceId) : undefined) ?? 'a task'}"`;
  switch (entry.action) {
    case 'AUTH_LOGIN':
      return 'Signed in';
    case 'AUTH_LOGOUT':
      return 'Signed out';
    case 'AUTH_LOGIN_FAILED':
      return `Failed sign-in attempt for ${text('email') ?? 'an unknown email'}`;
    case 'PASSWORD_CHANGED':
      return 'Changed their password';
    case 'PASSWORD_RESET_REQUESTED':
      return `Requested a password reset for ${text('email') ?? 'an account'}`;
    case 'PASSWORD_RESET_ISSUED':
      return `Issued a password reset link for ${person(entry.resourceId)}`;
    case 'PASSWORD_RESET_COMPLETED':
      return `Reset the password for ${person(entry.resourceId)}`;
    case 'USER_CREATED':
      return `Created ${text('role') === 'ADMIN' ? 'admin' : 'employee'} ${person(entry.resourceId)}`;
    case 'USER_UPDATED':
      return `Updated ${person(entry.resourceId)}`;
    case 'USER_DEACTIVATED':
      return `Deactivated ${person(entry.resourceId)}`;
    case 'USER_REACTIVATED':
      return `Reactivated ${person(entry.resourceId)}`;
    case 'TEAM_CREATED':
      return `Created team ${team(entry.resourceId)}`;
    case 'TEAM_UPDATED':
      return `Updated team ${team(entry.resourceId)}`;
    case 'TEAM_MEMBER_MOVED':
      return `Moved ${person(entry.resourceId)} to ${team(text('toTeamId'))}`;
    case 'TASK_ASSIGNED':
      return `Assigned ${task()} to ${person(text('assigneeId'))}`;
    case 'TASK_REASSIGNED':
      return `Reassigned ${task()} · ${person(text('from'))} → ${person(text('to'))}`;
    case 'TASK_DUE_DATE_CHANGED':
      return `Changed the due date of ${task()}`;
    case 'TASK_CANCELLED':
      return `Cancelled ${task()}`;
    case 'TASK_SELF_REPORTED':
      return `Logged ${task()} for review by ${person(text('reviewerId'))}`;
    case 'TASK_REVIEW_APPROVED':
      return `Approved ${task()} by ${person(text('authorId'))}`;
    case 'TASK_REVIEW_CHANGES_REQUESTED':
      return `Requested changes on ${task()} by ${person(text('authorId'))}`;
    case 'SETTINGS_UPDATED':
      return 'Updated organization settings';
  }
}

export const byRiskThenName = <T extends { risk: RiskLevel | null; user?: UserRef; team?: TeamRef | null }>(
  a: T,
  b: T,
) =>
  (b.risk ? RISK_SEVERITY[b.risk] : -1) - (a.risk ? RISK_SEVERITY[a.risk] : -1) ||
  (a.user?.name ?? a.team?.name ?? '').localeCompare(b.user?.name ?? b.team?.name ?? '');
