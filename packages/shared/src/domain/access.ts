import { isTeamManagerRole, isTeamMemberRole, type SystemRole, type TaskOrigin } from '../enums.js';

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
  return isTeamManagerRole(actor.role) && ownsTeam(actor, task.teamId);
}

/**
 * Edit details, reassign, cancel or reopen. Work assigned to a manager is managed above them: an
 * admin never manages their own tasks this way, and a sub admin never manages their admin's.
 */
export function canManageTask(actor: Actor, task: TaskScope, assigneeRole: SystemRole): boolean {
  if (actor.role === 'SUPER_ADMIN') return true;
  if (!isTeamManagerRole(actor.role) || task.assigneeId === actor.id) return false;
  // A sub admin runs the team's own work, never their admin's.
  if (actor.role === 'SUB_ADMIN' && !isTeamMemberRole(assigneeRole)) return false;
  return ownsTeam(actor, task.teamId);
}

/** Update progress and move a task through its working statuses. */
export function canWorkOnTask(actor: Actor, task: TaskScope, assigneeRole: SystemRole): boolean {
  return task.assigneeId === actor.id || canManageTask(actor, task, assigneeRole);
}

/** Super Admin → any admin, sub admin or employee. Team manager → members of their team. Never yourself. */
export function canAssignTo(actor: Actor, candidate: AssigneeCandidate): boolean {
  if (candidate.id === actor.id || candidate.role === 'SUPER_ADMIN') return false;
  if (actor.role === 'SUPER_ADMIN') return true;
  return isTeamManagerRole(actor.role) && isTeamMemberRole(candidate.role) && ownsTeam(actor, candidate.teamId);
}

/**
 * Appointing a Sub Admin stays with the team's owning admin and the Super Admin: a sub admin cannot
 * appoint more sub admins, so delegation never chains beyond the admin who granted it.
 */
export function canDelegateRole(actor: Actor, person: PersonScope): boolean {
  if (person.id === actor.id || !isTeamMemberRole(person.role)) return false;
  if (actor.role === 'SUPER_ADMIN') return true;
  return actor.role === 'ADMIN' && ownsTeam(actor, person.teamId);
}

/** A self-reported task and the reviewer its author chose. */
export interface ReviewScope extends TaskScope {
  origin: TaskOrigin;
  reviewerId: string | null;
}

/** A person an employee may send work to for review. */
export interface ReviewerCandidate {
  id: string;
  role: SystemRole;
  isActive: boolean;
  ownedTeamIds: readonly string[];
}

/**
 * Only the reviewer the employee chose decides — plus a Super Admin, who oversees the organization.
 * Nobody reviews their own work, and assigned tasks are never reviewed this way.
 */
export function canReviewTask(actor: Actor, task: ReviewScope): boolean {
  if (task.origin !== 'SELF_REPORTED' || task.assigneeId === actor.id) return false;
  if (actor.role === 'SUPER_ADMIN') return true;
  return isTeamManagerRole(actor.role) && task.reviewerId === actor.id;
}

/** A member may ask a Super Admin, or a manager of their team — never themselves. */
export function canReviewFor(reviewer: ReviewerCandidate, employee: PersonScope): boolean {
  if (!reviewer.isActive || reviewer.id === employee.id) return false;
  if (reviewer.role === 'SUPER_ADMIN') return true;
  return isTeamManagerRole(reviewer.role) && ownsTeam(reviewer, employee.teamId);
}

export function canViewPerson(actor: Actor, person: PersonScope): boolean {
  if (actor.role === 'SUPER_ADMIN' || actor.id === person.id) return true;
  return isTeamManagerRole(actor.role) && isTeamMemberRole(person.role) && ownsTeam(actor, person.teamId);
}

export function canViewTeam(actor: Actor, teamId: string): boolean {
  return actor.role === 'SUPER_ADMIN' || (isTeamManagerRole(actor.role) && ownsTeam(actor, teamId));
}
