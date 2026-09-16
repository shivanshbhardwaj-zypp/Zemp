import {
  OPEN_TASK_STATUSES,
  TASK_STATUS_LABELS,
  type AuditAction,
  type DeadlineState,
  type NotificationType,
  type RiskLevel,
  type TaskActivityType,
  type TaskPriority,
  type TaskStatus,
} from '../enums.js';
import { DomainError } from '../errors.js';
import { dayKey, daysBetween } from '../time.js';
import {
  canAssignTo,
  canManageTask,
  canViewTask,
  canWorkOnTask,
  type Actor,
  type AssigneeCandidate,
} from './access.js';

/** The task fields business rules need. Persistence layers map their rows onto this shape. */
export interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  assigneeId: string;
  assignorId: string;
  teamId: string | null;
  startAt: Date | null;
  dueAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}

export interface NamedActor extends Actor {
  name: string;
}

export interface TaskPermissions {
  canEdit: boolean;
  canReassign: boolean;
  canUpdateProgress: boolean;
  canComment: boolean;
  canCancel: boolean;
  canReopen: boolean;
}

export interface ActivityDraft {
  type: TaskActivityType;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
}

export interface NotificationDraft {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
}

export interface AuditDraft {
  action: AuditAction;
  metadata: Record<string, unknown>;
}

export interface TaskPatch {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  progress?: number;
  assigneeId?: string;
  teamId?: string | null;
  startAt?: Date | null;
  dueAt?: Date;
  completedAt?: Date | null;
  completionNote?: string | null;
  /** Deadline reminders are re-armed when the due date moves. */
  resetDeadlineReminders?: boolean;
}

/** The outcome of a task command: what to write, which history to append, who to notify. */
export interface TaskPlan {
  patch: TaskPatch;
  activities: ActivityDraft[];
  notifications: NotificationDraft[];
  audits: AuditDraft[];
}

/** requirements §7 — plus BLOCKED → CANCELLED and an explicit, manager-only reopen. */
export const STATUS_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['BLOCKED', 'COMPLETED', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: ['IN_PROGRESS'],
  CANCELLED: [],
};

/** Paced-progress slack before a single task counts as at risk (10 percentage points). */
export const TASK_RISK_TOLERANCE = 0.1;

const isManagerOnlyTransition = (from: TaskStatus, to: TaskStatus) =>
  to === 'CANCELLED' || (from === 'COMPLETED' && to === 'IN_PROGRESS');

export const isOpenStatus = (status: TaskStatus) => OPEN_TASK_STATUSES.includes(status);

/** requirements §11: now > due date and not completed or cancelled. */
export function isOverdue(task: Pick<TaskRecord, 'status' | 'dueAt'>, now: Date): boolean {
  return isOpenStatus(task.status) && task.dueAt.getTime() < now.getTime();
}

export function deadlineState(
  task: Pick<TaskRecord, 'status' | 'dueAt' | 'completedAt'>,
  now: Date,
  timeZone: string,
): DeadlineState {
  if (task.status === 'CANCELLED') return 'CANCELLED';
  if (task.status === 'COMPLETED') {
    return task.completedAt && task.completedAt > task.dueAt ? 'COMPLETED_LATE' : 'COMPLETED_ON_TIME';
  }
  if (isOverdue(task, now)) return 'OVERDUE';
  const days = daysBetween(dayKey(now, timeZone), dayKey(task.dueAt, timeZone));
  return days <= 0 ? 'DUE_TODAY' : days === 1 ? 'DUE_TOMORROW' : 'UPCOMING';
}

/** Single-task risk: overdue, blocked, or reported progress behind the time elapsed toward the deadline. */
export function taskRisk(
  task: Pick<TaskRecord, 'status' | 'progress' | 'dueAt' | 'startAt' | 'createdAt'>,
  now: Date,
): RiskLevel | null {
  if (task.status === 'CANCELLED') return null;
  if (task.status === 'COMPLETED') return 'COMPLETED';
  if (isOverdue(task, now)) return 'OVERDUE';
  if (task.status === 'BLOCKED') return 'AT_RISK';
  const start = (task.startAt ?? task.createdAt).getTime();
  const span = task.dueAt.getTime() - start;
  const expected = span <= 0 ? 1 : Math.min(Math.max((now.getTime() - start) / span, 0), 1);
  return task.progress / 100 + TASK_RISK_TOLERANCE < expected ? 'AT_RISK' : 'ON_TRACK';
}

export function allowedTransitions(actor: Actor, task: TaskRecord): TaskStatus[] {
  if (!canWorkOnTask(actor, task)) return [];
  const manager = canManageTask(actor, task);
  return STATUS_TRANSITIONS[task.status].filter(
    (to) => manager || !isManagerOnlyTransition(task.status, to),
  );
}

export function taskPermissions(actor: Actor, task: TaskRecord): TaskPermissions {
  const open = isOpenStatus(task.status);
  const manager = canManageTask(actor, task);
  return {
    canEdit: manager && open,
    canReassign: manager && open,
    canUpdateProgress: open && canWorkOnTask(actor, task),
    canComment: canViewTask(actor, task),
    canCancel: manager && open,
    canReopen: manager && task.status === 'COMPLETED',
  };
}

const emptyPlan = (): TaskPlan => ({ patch: {}, activities: [], notifications: [], audits: [] });

const activity = (
  type: TaskActivityType,
  fromValue: string | null = null,
  toValue: string | null = null,
  note: string | null = null,
): ActivityDraft => ({ type, fromValue, toValue, note });

function notify(
  plan: TaskPlan,
  actor: NamedActor,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
) {
  if (userId !== actor.id && !plan.notifications.some((n) => n.userId === userId && n.type === type)) {
    plan.notifications.push({ userId, type, title, body });
  }
}

function assertVisible(actor: Actor, task: TaskRecord) {
  if (!canViewTask(actor, task)) throw new DomainError('TASK_NOT_FOUND');
}

function assertManageable(actor: Actor, task: TaskRecord) {
  assertVisible(actor, task);
  if (!canManageTask(actor, task)) throw new DomainError('FORBIDDEN');
  if (!isOpenStatus(task.status)) throw new DomainError('TASK_NOT_EDITABLE');
}

/** Scope is checked before activity so out-of-scope accounts reveal nothing about their state. */
export function assertAssignable(actor: Actor, assignee: AssigneeCandidate) {
  if (!canAssignTo(actor, assignee)) throw new DomainError('ASSIGNEE_OUT_OF_SCOPE');
  if (!assignee.isActive) throw new DomainError('ASSIGNEE_INACTIVE');
}

/** Employees work inside their current team; admin-level work sits in a team the admin owns. */
export function resolveTaskTeam(assignee: AssigneeCandidate, requestedTeamId?: string | null) {
  if (assignee.role === 'EMPLOYEE') {
    if (!assignee.teamId) throw new DomainError('INVALID_TEAM', 'This employee is not in a team yet.');
    if (requestedTeamId && requestedTeamId !== assignee.teamId) {
      throw new DomainError('INVALID_TEAM', 'The employee is not a member of the selected team.');
    }
    return assignee.teamId;
  }
  if (requestedTeamId) {
    if (!assignee.ownedTeamIds.includes(requestedTeamId)) {
      throw new DomainError('INVALID_TEAM', 'The admin does not manage the selected team.');
    }
    return requestedTeamId;
  }
  return assignee.ownedTeamIds[0] ?? null;
}

export interface NewTaskInput {
  title: string;
  description?: string | null;
  priority: TaskPriority;
  startAt?: Date | null;
  dueAt: Date;
  teamId?: string | null;
}

export interface NewTaskPlan {
  task: Omit<TaskRecord, 'id' | 'createdAt'>;
  activities: ActivityDraft[];
  notifications: NotificationDraft[];
  audits: AuditDraft[];
}

export function planCreateTask(args: {
  actor: NamedActor;
  assignee: AssigneeCandidate;
  input: NewTaskInput;
  now: Date;
}): NewTaskPlan {
  const { actor, assignee, input, now } = args;
  if (actor.role === 'EMPLOYEE') throw new DomainError('FORBIDDEN');
  assertAssignable(actor, assignee);
  if (input.dueAt.getTime() <= now.getTime()) throw new DomainError('INVALID_DUE_DATE');
  if (input.startAt && input.startAt > input.dueAt) {
    throw new DomainError('INVALID_DUE_DATE', 'The due date must be after the start date.');
  }
  const teamId = resolveTaskTeam(assignee, input.teamId);
  const plan = emptyPlan();
  notify(
    plan,
    actor,
    assignee.id,
    'TASK_ASSIGNED',
    'Task assigned to you',
    `${actor.name} assigned "${input.title}" to you.`,
  );
  return {
    task: {
      title: input.title,
      description: input.description ?? null,
      status: 'TODO',
      priority: input.priority,
      progress: 0,
      assigneeId: assignee.id,
      assignorId: actor.id,
      teamId,
      startAt: input.startAt ?? null,
      dueAt: input.dueAt,
      completedAt: null,
    },
    activities: [activity('CREATED'), activity('ASSIGNED', null, assignee.id)],
    notifications: plan.notifications,
    audits: [
      {
        action: 'TASK_ASSIGNED',
        metadata: { assigneeId: assignee.id, teamId, dueAt: input.dueAt.toISOString() },
      },
    ],
  };
}

export function planStatusChange(args: {
  actor: NamedActor;
  task: TaskRecord;
  to: TaskStatus;
  note?: string | null;
  now: Date;
}): TaskPlan {
  const { actor, task, to, now } = args;
  const note = args.note?.trim() || null;
  assertVisible(actor, task);
  const plan = emptyPlan();
  const from = task.status;
  if (from === to) return plan;
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw new DomainError(
      'INVALID_STATUS_TRANSITION',
      `A task cannot move from ${TASK_STATUS_LABELS[from]} to ${TASK_STATUS_LABELS[to]}.`,
    );
  }
  if (!allowedTransitions(actor, task).includes(to)) throw new DomainError('FORBIDDEN');

  plan.patch.status = to;
  if (to === 'COMPLETED') {
    plan.patch.progress = 100;
    plan.patch.completedAt = now;
    plan.patch.completionNote = note;
    if (task.progress !== 100) {
      plan.activities.push(activity('PROGRESS_CHANGED', String(task.progress), '100'));
    }
    plan.activities.push(activity('COMPLETED', from, to, note));
    notify(plan, actor, task.assignorId, 'TASK_COMPLETED', 'Task completed', `${actor.name} completed "${task.title}".`);
  } else if (to === 'CANCELLED') {
    plan.activities.push(activity('CANCELLED', from, to, note));
    plan.audits.push({ action: 'TASK_CANCELLED', metadata: { from, note } });
    notify(plan, actor, task.assigneeId, 'TASK_CANCELLED', 'Task cancelled', `${actor.name} cancelled "${task.title}".`);
  } else if (from === 'COMPLETED') {
    // Reopen: a task at 100% is complete by definition, so reopened work drops to 99%.
    plan.patch.progress = Math.min(task.progress, 99);
    plan.patch.completedAt = null;
    plan.patch.completionNote = null;
    plan.activities.push(activity('REOPENED', from, to, note));
    if (task.progress > 99) plan.activities.push(activity('PROGRESS_CHANGED', String(task.progress), '99'));
    notify(plan, actor, task.assigneeId, 'TASK_REOPENED', 'Task reopened', `${actor.name} reopened "${task.title}".`);
  } else {
    plan.activities.push(activity('STATUS_CHANGED', from, to, note));
    if (to === 'BLOCKED') {
      notify(
        plan,
        actor,
        task.assignorId,
        'TASK_BLOCKED',
        'Task blocked',
        `${actor.name} marked "${task.title}" as blocked${note ? `: ${note}` : '.'}`,
      );
    }
  }
  return plan;
}

export function planProgressUpdate(args: {
  actor: NamedActor;
  task: TaskRecord;
  progress: number;
  now: Date;
}): TaskPlan {
  const { actor, task, progress, now } = args;
  assertVisible(actor, task);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    throw new DomainError('INVALID_PROGRESS');
  }
  if (!isOpenStatus(task.status)) throw new DomainError('TASK_NOT_EDITABLE');
  if (!canWorkOnTask(actor, task)) throw new DomainError('FORBIDDEN');
  if (progress === task.progress) return emptyPlan();

  const plan = emptyPlan();
  if (progress === 100) {
    if (task.status === 'BLOCKED') {
      throw new DomainError('INVALID_STATUS_TRANSITION', 'Unblock the task before completing it.');
    }
    // 100% means done (requirements §9): complete the task, starting it first if needed.
    if (task.status === 'TODO') plan.activities.push(activity('STATUS_CHANGED', 'TODO', 'IN_PROGRESS'));
    const completion = planStatusChange({ actor, task: { ...task, status: 'IN_PROGRESS' }, to: 'COMPLETED', now });
    return {
      patch: completion.patch,
      activities: [...plan.activities, ...completion.activities],
      notifications: completion.notifications,
      audits: completion.audits,
    };
  }
  plan.patch.progress = progress;
  if (task.status === 'TODO' && progress > 0) {
    plan.patch.status = 'IN_PROGRESS';
    plan.activities.push(activity('STATUS_CHANGED', 'TODO', 'IN_PROGRESS'));
  }
  plan.activities.push(activity('PROGRESS_CHANGED', String(task.progress), String(progress)));
  return plan;
}

export interface TaskEditInput {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  startAt?: Date | null;
  dueAt?: Date;
}

export function planTaskUpdate(args: {
  actor: NamedActor;
  task: TaskRecord;
  input: TaskEditInput;
  now: Date;
}): TaskPlan {
  const { actor, task, input, now } = args;
  assertManageable(actor, task);
  const plan = emptyPlan();
  const changedFields: string[] = [];

  if (input.title !== undefined && input.title !== task.title) {
    plan.patch.title = input.title;
    changedFields.push('title');
  }
  if (input.description !== undefined && (input.description || null) !== task.description) {
    plan.patch.description = input.description || null;
    changedFields.push('description');
  }
  const startChanged =
    input.startAt !== undefined && (input.startAt?.getTime() ?? null) !== (task.startAt?.getTime() ?? null);
  if (startChanged) {
    plan.patch.startAt = input.startAt ?? null;
    changedFields.push('start date');
  }
  if (changedFields.length) plan.activities.push(activity('UPDATED', null, changedFields.join(', ')));

  if (input.priority && input.priority !== task.priority) {
    plan.patch.priority = input.priority;
    plan.activities.push(activity('PRIORITY_CHANGED', task.priority, input.priority));
    if (input.priority === 'URGENT') {
      notify(plan, actor, task.assigneeId, 'TASK_UPDATED', 'Task marked urgent', `${actor.name} marked "${task.title}" as urgent.`);
    }
  }

  if (input.dueAt && input.dueAt.getTime() !== task.dueAt.getTime()) {
    if (input.dueAt.getTime() <= now.getTime()) throw new DomainError('INVALID_DUE_DATE');
    plan.patch.dueAt = input.dueAt;
    plan.patch.resetDeadlineReminders = true;
    plan.activities.push(activity('DUE_DATE_CHANGED', task.dueAt.toISOString(), input.dueAt.toISOString()));
    plan.audits.push({
      action: 'TASK_DUE_DATE_CHANGED',
      metadata: { from: task.dueAt.toISOString(), to: input.dueAt.toISOString() },
    });
    notify(plan, actor, task.assigneeId, 'TASK_UPDATED', 'Due date changed', `${actor.name} changed the due date of "${task.title}".`);
  }

  const startAt = plan.patch.startAt !== undefined ? plan.patch.startAt : task.startAt;
  const dueAt = plan.patch.dueAt ?? task.dueAt;
  if (startAt && startAt > dueAt) {
    throw new DomainError('INVALID_DUE_DATE', 'The due date must be after the start date.');
  }
  return plan;
}

export function planReassign(args: {
  actor: NamedActor;
  task: TaskRecord;
  assignee: AssigneeCandidate;
  teamId?: string | null;
}): TaskPlan {
  const { actor, task, assignee } = args;
  assertManageable(actor, task);
  const plan = emptyPlan();
  if (assignee.id === task.assigneeId) return plan;
  assertAssignable(actor, assignee);
  const teamId = resolveTaskTeam(assignee, args.teamId);

  plan.patch.assigneeId = assignee.id;
  plan.patch.teamId = teamId;
  plan.activities.push(activity('REASSIGNED', task.assigneeId, assignee.id));
  plan.audits.push({ action: 'TASK_REASSIGNED', metadata: { from: task.assigneeId, to: assignee.id, teamId } });
  notify(plan, actor, assignee.id, 'TASK_ASSIGNED', 'Task assigned to you', `${actor.name} assigned "${task.title}" to you.`);
  notify(plan, actor, task.assigneeId, 'TASK_REASSIGNED', 'Task reassigned', `"${task.title}" was reassigned to ${assignee.name}.`);
  return plan;
}

export function planComment(args: { actor: NamedActor; task: TaskRecord }): TaskPlan {
  const { actor, task } = args;
  assertVisible(actor, task);
  const plan = emptyPlan();
  plan.activities.push(activity('COMMENT_ADDED'));
  const body = `${actor.name} commented on "${task.title}".`;
  notify(plan, actor, task.assigneeId, 'COMMENT_ADDED', 'New comment', body);
  notify(plan, actor, task.assignorId, 'COMMENT_ADDED', 'New comment', body);
  return plan;
}
