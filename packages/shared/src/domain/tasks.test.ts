import { describe, expect, it } from 'vitest';
import type { DomainError } from '../errors.js';
import type { AssigneeCandidate } from './access.js';
import {
  allowedTransitions,
  deadlineState,
  planCreateTask,
  planProgressUpdate,
  planReassign,
  planStatusChange,
  planTaskUpdate,
  taskPermissions,
  taskRisk,
  type NamedActor,
  type TaskRecord,
} from './tasks.js';

const TZ = 'Asia/Kolkata';
const now = new Date('2026-09-14T06:30:00Z'); // 12:00 IST

const superAdmin: NamedActor = { id: 'john', name: 'John', role: 'SUPER_ADMIN', ownedTeamIds: [] };
const rock: NamedActor = { id: 'rock', name: 'Rock', role: 'ADMIN', ownedTeamIds: ['team-rock'] };
const bruce: NamedActor = { id: 'bruce', name: 'Bruce', role: 'ADMIN', ownedTeamIds: ['team-bruce'] };
const alice: NamedActor = { id: 'alice', name: 'Alice', role: 'EMPLOYEE', ownedTeamIds: [] };
const bob: NamedActor = { id: 'bob', name: 'Bob', role: 'EMPLOYEE', ownedTeamIds: [] };

const task = (over: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 't1',
  title: 'Homepage audit',
  description: null,
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  progress: 40,
  assigneeId: 'alice',
  assignorId: 'rock',
  teamId: 'team-rock',
  startAt: null,
  dueAt: new Date('2026-09-16T12:30:00Z'),
  completedAt: null,
  createdAt: new Date('2026-09-12T04:30:00Z'),
  ...over,
});

const candidate = (over: Partial<AssigneeCandidate> = {}): AssigneeCandidate => ({
  id: 'alice',
  name: 'Alice',
  role: 'EMPLOYEE',
  isActive: true,
  teamId: 'team-rock',
  ownedTeamIds: [],
  ...over,
});

const errorCode = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'NO_ERROR';
};

describe('access and transitions', () => {
  it('lets the assignee move work forward but not cancel or reopen it', () => {
    expect(allowedTransitions(alice, task())).toEqual(['BLOCKED', 'COMPLETED']);
    expect(allowedTransitions(alice, task({ status: 'COMPLETED', progress: 100 }))).toEqual([]);
  });

  it('gives the owning admin full control and other admins nothing', () => {
    expect(allowedTransitions(rock, task())).toEqual(['BLOCKED', 'COMPLETED', 'CANCELLED']);
    expect(allowedTransitions(bruce, task())).toEqual([]);
    expect(taskPermissions(bruce, task()).canComment).toBe(false);
  });

  it('treats work assigned to an admin as theirs to do, not to manage', () => {
    const adminTask = task({ assigneeId: 'rock', assignorId: 'john' });
    expect(taskPermissions(rock, adminTask)).toMatchObject({
      canUpdateProgress: true,
      canEdit: false,
      canCancel: false,
    });
    expect(taskPermissions(superAdmin, adminTask).canEdit).toBe(true);
  });

  it("hides other people's tasks behind not-found (IDOR)", () => {
    expect(errorCode(() => planProgressUpdate({ actor: bob, task: task(), progress: 50, now }))).toBe(
      'TASK_NOT_FOUND',
    );
    expect(errorCode(() => planStatusChange({ actor: bruce, task: task(), to: 'CANCELLED', now }))).toBe(
      'TASK_NOT_FOUND',
    );
  });
});

describe('status changes', () => {
  it('rejects transitions outside the lifecycle', () => {
    const todo = task({ status: 'TODO', progress: 0 });
    expect(errorCode(() => planStatusChange({ actor: rock, task: todo, to: 'COMPLETED', now }))).toBe(
      'INVALID_STATUS_TRANSITION',
    );
    const cancelled = task({ status: 'CANCELLED' });
    expect(
      errorCode(() => planStatusChange({ actor: superAdmin, task: cancelled, to: 'IN_PROGRESS', now })),
    ).toBe('INVALID_STATUS_TRANSITION');
  });

  it('forbids employees from cancelling', () => {
    expect(errorCode(() => planStatusChange({ actor: alice, task: task(), to: 'CANCELLED', now }))).toBe(
      'FORBIDDEN',
    );
  });

  it('completes at 100% with a timestamp, history and a notification for the assignor', () => {
    const plan = planStatusChange({ actor: alice, task: task(), to: 'COMPLETED', note: 'Shipped', now });
    expect(plan.patch).toMatchObject({
      status: 'COMPLETED',
      progress: 100,
      completedAt: now,
      completionNote: 'Shipped',
    });
    expect(plan.activities.map((a) => a.type)).toEqual(['PROGRESS_CHANGED', 'COMPLETED']);
    expect(plan.notifications).toEqual([expect.objectContaining({ userId: 'rock', type: 'TASK_COMPLETED' })]);
  });

  it('reopens completed work explicitly and drops progress below 100', () => {
    const done = task({ status: 'COMPLETED', progress: 100, completedAt: now });
    const plan = planStatusChange({ actor: rock, task: done, to: 'IN_PROGRESS', now });
    expect(plan.patch).toMatchObject({ status: 'IN_PROGRESS', progress: 99, completedAt: null });
    expect(plan.activities[0]?.type).toBe('REOPENED');
  });
});

describe('progress updates', () => {
  it('starts a to-do task when progress begins', () => {
    const plan = planProgressUpdate({ actor: alice, task: task({ status: 'TODO', progress: 0 }), progress: 20, now });
    expect(plan.patch).toEqual({ progress: 20, status: 'IN_PROGRESS' });
  });

  it('treats 100% as completion', () => {
    const plan = planProgressUpdate({ actor: alice, task: task({ status: 'TODO', progress: 0 }), progress: 100, now });
    expect(plan.patch).toMatchObject({ status: 'COMPLETED', progress: 100 });
    expect(plan.activities.map((a) => a.type)).toEqual(['STATUS_CHANGED', 'PROGRESS_CHANGED', 'COMPLETED']);
  });

  it('rejects invalid values, completing blocked work and changing finished tasks', () => {
    for (const progress of [101, -1, 12.5]) {
      expect(errorCode(() => planProgressUpdate({ actor: alice, task: task(), progress, now }))).toBe(
        'INVALID_PROGRESS',
      );
    }
    expect(
      errorCode(() => planProgressUpdate({ actor: alice, task: task({ status: 'BLOCKED' }), progress: 100, now })),
    ).toBe('INVALID_STATUS_TRANSITION');
    expect(
      errorCode(() =>
        planProgressUpdate({ actor: alice, task: task({ status: 'COMPLETED', progress: 100 }), progress: 50, now }),
      ),
    ).toBe('TASK_NOT_EDITABLE');
  });
});

describe('assignment', () => {
  const input = { title: 'Write release notes', priority: 'MEDIUM' as const, dueAt: new Date('2026-09-18T12:30:00Z') };
  const rockAsCandidate = candidate({ id: 'rock', name: 'Rock', role: 'ADMIN', teamId: null, ownedTeamIds: ['team-rock'] });

  it('lets an admin assign only within their own team', () => {
    expect(planCreateTask({ actor: rock, assignee: candidate(), input, now }).task).toMatchObject({
      assigneeId: 'alice',
      teamId: 'team-rock',
      status: 'TODO',
      progress: 0,
    });
    expect(errorCode(() => planCreateTask({ actor: bruce, assignee: candidate(), input, now }))).toBe(
      'ASSIGNEE_OUT_OF_SCOPE',
    );
    expect(errorCode(() => planCreateTask({ actor: bruce, assignee: rockAsCandidate, input, now }))).toBe(
      'ASSIGNEE_OUT_OF_SCOPE',
    );
  });

  it('lets the super admin assign to admins, inside a team the admin owns', () => {
    const plan = planCreateTask({ actor: superAdmin, assignee: rockAsCandidate, input, now });
    expect(plan.task.teamId).toBe('team-rock');
  });

  it('blocks employees, inactive assignees and past due dates', () => {
    expect(errorCode(() => planCreateTask({ actor: alice, assignee: candidate({ id: 'bob' }), input, now }))).toBe(
      'FORBIDDEN',
    );
    expect(
      errorCode(() => planCreateTask({ actor: rock, assignee: candidate({ isActive: false }), input, now })),
    ).toBe('ASSIGNEE_INACTIVE');
    const pastDue = { ...input, dueAt: new Date('2026-09-13T12:30:00Z') };
    expect(errorCode(() => planCreateTask({ actor: rock, assignee: candidate(), input: pastDue, now }))).toBe(
      'INVALID_DUE_DATE',
    );
  });

  it('reassigns with history, an audit entry and notifications to both people', () => {
    const plan = planReassign({ actor: rock, task: task(), assignee: candidate({ id: 'carol', name: 'Carol' }) });
    expect(plan.patch).toEqual({ assigneeId: 'carol', teamId: 'team-rock' });
    expect(plan.audits[0]?.action).toBe('TASK_REASSIGNED');
    expect(plan.notifications.map((n) => [n.userId, n.type])).toEqual([
      ['carol', 'TASK_ASSIGNED'],
      ['alice', 'TASK_REASSIGNED'],
    ]);
  });

  it('audits due date changes and rejects moving them into the past', () => {
    const later = { dueAt: new Date('2026-09-20T12:30:00Z') };
    expect(planTaskUpdate({ actor: rock, task: task(), input: later, now }).audits[0]?.action).toBe(
      'TASK_DUE_DATE_CHANGED',
    );
    const earlier = { dueAt: new Date('2026-09-10T12:30:00Z') };
    expect(errorCode(() => planTaskUpdate({ actor: rock, task: task(), input: earlier, now }))).toBe(
      'INVALID_DUE_DATE',
    );
    expect(errorCode(() => planTaskUpdate({ actor: alice, task: task(), input: { title: 'Renamed' }, now }))).toBe(
      'FORBIDDEN',
    );
  });
});

describe('deadlines and risk', () => {
  it('classifies deadlines in the organization time zone', () => {
    expect(deadlineState(task({ dueAt: new Date('2026-09-14T12:30:00Z') }), now, TZ)).toBe('DUE_TODAY');
    // 01:00 IST on 15 Sep is "tomorrow" even though it is still 14 Sep in UTC.
    expect(deadlineState(task({ dueAt: new Date('2026-09-14T19:30:00Z') }), now, TZ)).toBe('DUE_TOMORROW');
    expect(deadlineState(task({ dueAt: new Date('2026-09-14T06:00:00Z') }), now, TZ)).toBe('OVERDUE');
    const lateDone = task({ status: 'COMPLETED', completedAt: new Date('2026-09-17T00:00:00Z') });
    expect(deadlineState(lateDone, now, TZ)).toBe('COMPLETED_LATE');
  });

  it('flags work that is behind its pace, blocked or overdue', () => {
    const paced = { startAt: new Date('2026-09-10T06:30:00Z'), dueAt: new Date('2026-09-18T06:30:00Z') }; // half elapsed
    expect(taskRisk(task({ ...paced, progress: 45 }), now)).toBe('ON_TRACK');
    expect(taskRisk(task({ ...paced, progress: 20 }), now)).toBe('AT_RISK');
    expect(taskRisk(task({ status: 'BLOCKED' }), now)).toBe('AT_RISK');
    expect(taskRisk(task({ dueAt: new Date('2026-09-13T00:00:00Z') }), now)).toBe('OVERDUE');
  });
});
