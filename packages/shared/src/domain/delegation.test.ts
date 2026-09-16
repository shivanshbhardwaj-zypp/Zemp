import { describe, expect, it } from 'vitest';
import type { DomainError } from '../errors.js';
import { canAssignTo, canDelegateRole, canManageTask, canViewPerson, canViewTask } from './access.js';
import { planRoleChange, type DelegationTarget } from './delegation.js';
import { planStatusChange, planTaskUpdate, taskPermissions, type NamedActor } from './tasks.js';

const rock: NamedActor = { id: 'rock', name: 'Rock', role: 'ADMIN', ownedTeamIds: ['team-rock'] };
const bruce: NamedActor = { id: 'bruce', name: 'Bruce', role: 'ADMIN', ownedTeamIds: ['team-bruce'] };
const john: NamedActor = { id: 'john', name: 'John', role: 'SUPER_ADMIN', ownedTeamIds: [] };
/** A sub admin's managed team is the team they belong to. */
const sub: NamedActor = { id: 'sub', name: 'Sasha', role: 'SUB_ADMIN', ownedTeamIds: ['team-rock'] };
const employee: NamedActor = { id: 'alice', name: 'Alice', role: 'EMPLOYEE', ownedTeamIds: [] };

const target = (over: Partial<DelegationTarget> = {}): DelegationTarget => ({
  id: 'alice',
  name: 'Alice',
  role: 'EMPLOYEE',
  teamId: 'team-rock',
  isActive: true,
  ...over,
});

const errorCode = (fn: () => unknown) => {
  try {
    fn();
    return 'NO_ERROR';
  } catch (error) {
    return (error as DomainError).code;
  }
};

describe('appointing a Sub Admin', () => {
  it('lets the owning admin promote and demote a member of their team', () => {
    const promote = planRoleChange({ actor: rock, person: target(), to: 'SUB_ADMIN', teamName: 'Product Engineering' });
    expect(promote.patch).toEqual({ role: 'SUB_ADMIN' });
    expect(promote.audits[0]).toMatchObject({ action: 'USER_ROLE_CHANGED', metadata: { from: 'EMPLOYEE', to: 'SUB_ADMIN' } });
    expect(promote.notifications[0]).toMatchObject({ userId: 'alice', title: 'You are now a Sub Admin' });

    const demote = planRoleChange({ actor: rock, person: target({ role: 'SUB_ADMIN' }), to: 'EMPLOYEE' });
    expect(demote.patch).toEqual({ role: 'EMPLOYEE' });
  });

  it('refuses an admin from another team, and an employee', () => {
    expect(errorCode(() => planRoleChange({ actor: bruce, person: target(), to: 'SUB_ADMIN' }))).toBe('FORBIDDEN');
    expect(errorCode(() => planRoleChange({ actor: employee, person: target({ id: 'bob' }), to: 'SUB_ADMIN' }))).toBe('FORBIDDEN');
  });

  it('does not let a sub admin appoint more sub admins', () => {
    expect(canDelegateRole(sub, target())).toBe(false);
    expect(errorCode(() => planRoleChange({ actor: sub, person: target(), to: 'SUB_ADMIN' }))).toBe('FORBIDDEN');
  });

  it('never touches an admin or the actor themselves', () => {
    expect(errorCode(() => planRoleChange({ actor: john, person: target({ id: 'bruce', role: 'ADMIN' }), to: 'EMPLOYEE' }))).toBe(
      'FORBIDDEN',
    );
    expect(errorCode(() => planRoleChange({ actor: rock, person: target({ id: 'rock' }), to: 'SUB_ADMIN' }))).toBe('FORBIDDEN');
  });

  it('requires an active account in a team, and refuses a no-op', () => {
    expect(errorCode(() => planRoleChange({ actor: rock, person: target({ isActive: false }), to: 'SUB_ADMIN' }))).toBe(
      'VALIDATION_ERROR',
    );
    expect(errorCode(() => planRoleChange({ actor: john, person: target({ teamId: null }), to: 'SUB_ADMIN' }))).toBe('INVALID_TEAM');
    expect(errorCode(() => planRoleChange({ actor: rock, person: target({ role: 'SUB_ADMIN' }), to: 'SUB_ADMIN' }))).toBe('CONFLICT');
  });
});

describe('what a Sub Admin may do', () => {
  const teamTask = { assigneeId: 'alice', teamId: 'team-rock' };
  const adminTask = { assigneeId: 'rock', teamId: 'team-rock' };
  const otherTeamTask = { assigneeId: 'zed', teamId: 'team-bruce' };

  it('runs their own team like the admin does', () => {
    expect(canViewTask(sub, teamTask)).toBe(true);
    expect(canManageTask(sub, teamTask, 'EMPLOYEE')).toBe(true);
    expect(canViewPerson(sub, { id: 'alice', role: 'EMPLOYEE', teamId: 'team-rock' })).toBe(true);
    expect(
      canAssignTo(sub, { id: 'alice', name: 'Alice', role: 'EMPLOYEE', isActive: true, teamId: 'team-rock', ownedTeamIds: [] }),
    ).toBe(true);
  });

  it('cannot manage their own admin’s work, nor their own task as a manager', () => {
    expect(canManageTask(sub, adminTask, 'ADMIN')).toBe(false);
    expect(canManageTask(sub, { assigneeId: 'sub', teamId: 'team-rock' }, 'SUB_ADMIN')).toBe(false);
    expect(
      canAssignTo(sub, { id: 'rock', name: 'Rock', role: 'ADMIN', isActive: true, teamId: null, ownedTeamIds: ['team-rock'] }),
    ).toBe(false);
  });

  it('is refused by the planners, not just the read model, on the admin’s work', () => {
    const adminsTask = {
      id: 't9',
      title: 'Quarterly plan',
      description: null,
      status: 'TODO' as const,
      priority: 'HIGH' as const,
      progress: 0,
      assigneeId: 'rock',
      assignorId: 'john',
      teamId: 'team-rock',
      startAt: null,
      dueAt: new Date('2026-09-20T12:30:00Z'),
      completedAt: null,
      createdAt: new Date('2026-09-10T04:30:00Z'),
      origin: 'ASSIGNED' as const,
      reviewerId: null,
      reviewStatus: null,
      reviewedAt: null,
      reviewNote: null,
      evidenceUrl: null,
    };
    const now = new Date('2026-09-16T06:30:00Z');
    expect(errorCode(() => planTaskUpdate({ actor: sub, task: adminsTask, input: { title: 'Hijacked' }, assigneeRole: 'ADMIN', now }))).toBe(
      'FORBIDDEN',
    );
    expect(errorCode(() => planStatusChange({ actor: sub, task: adminsTask, to: 'CANCELLED', assigneeRole: 'ADMIN', now }))).toBe(
      'FORBIDDEN',
    );
    expect(taskPermissions(sub, adminsTask, 'ADMIN')).toMatchObject({ canEdit: false, canCancel: false });
  });

  it('sees nothing outside their team', () => {
    expect(canViewTask(sub, otherTeamTask)).toBe(false);
    expect(canManageTask(sub, otherTeamTask, 'EMPLOYEE')).toBe(false);
    expect(canViewPerson(sub, { id: 'zed', role: 'EMPLOYEE', teamId: 'team-bruce' })).toBe(false);
  });
});
