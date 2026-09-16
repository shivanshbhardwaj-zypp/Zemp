import type { SystemRole } from '../enums.js';

/**
 * Server-side scope rules (requirements §18): system role + team scope + resource ownership.
 * Super Admin → whole organization. Admin → teams they own. Employee → their own work.
 */
export interface Actor {
  id: string;
  role: SystemRole;
  /** Active teams owned by this user. Only admins own teams. */
  ownedTeamIds: readonly string[];
}

export interface TaskScope {
  assigneeId: string;
  teamId: string | null;
}

export interface PersonScope {
  id: string;
  role: SystemRole;
  teamId: string | null;
}

/** A user being considered as a task assignee. */
export interface AssigneeCandidate extends PersonScope {
  name: string;
  isActive: boolean;
  ownedTeamIds: readonly string[];
}

const ownsTeam = (actor: Actor, teamId: string | null) =>
  teamId !== null && actor.ownedTeamIds.includes(teamId);

export function canViewTask(actor: Actor, task: TaskScope): boolean {
  if (actor.role === 'SUPER_ADMIN' || task.assigneeId === actor.id) return true;
  return actor.role === 'ADMIN' && ownsTeam(actor, task.teamId);
}

/** Edit details, reassign, cancel or reopen. Work assigned to an admin is managed above them. */
export function canManageTask(actor: Actor, task: TaskScope): boolean {
  if (actor.role === 'SUPER_ADMIN') return true;
  return actor.role === 'ADMIN' && task.assigneeId !== actor.id && ownsTeam(actor, task.teamId);
}

/** Update progress and move a task through its working statuses. */
export function canWorkOnTask(actor: Actor, task: TaskScope): boolean {
  return task.assigneeId === actor.id || canManageTask(actor, task);
}

/** Super Admin → any admin or employee. Admin → employees of teams they own. Never yourself. */
export function canAssignTo(actor: Actor, candidate: AssigneeCandidate): boolean {
  if (candidate.id === actor.id || candidate.role === 'SUPER_ADMIN') return false;
  if (actor.role === 'SUPER_ADMIN') return true;
  return actor.role === 'ADMIN' && candidate.role === 'EMPLOYEE' && ownsTeam(actor, candidate.teamId);
}

export function canViewPerson(actor: Actor, person: PersonScope): boolean {
  if (actor.role === 'SUPER_ADMIN' || actor.id === person.id) return true;
  return actor.role === 'ADMIN' && person.role === 'EMPLOYEE' && ownsTeam(actor, person.teamId);
}

export function canViewTeam(actor: Actor, teamId: string): boolean {
  return actor.role === 'SUPER_ADMIN' || (actor.role === 'ADMIN' && ownsTeam(actor, teamId));
}
