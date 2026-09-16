/**
 * PHASE A MOCK — a temporary in-memory stand-in for the NestJS API so the frontend can be completed
 * first (master build plan, Phase A). It follows the same /api/v1 contract, business rules and scope
 * checks via @zemp/shared, regenerates seed data on server start and is deleted in Phase D.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import {
  ROLE_PERMISSIONS,
  activityLabels,
  canViewTask,
  toTaskSummary,
  type AssigneeCandidate,
  type AuditAction,
  type AuditResourceType,
  type AuditResult,
  type NamedActor,
  type SessionUser,
  type TaskActivityEntry,
  type TaskDetail,
  type TaskSummary,
  type TeamRef,
  type UserRef,
} from '@zemp/shared';
import {
  DEMO_PASSWORD,
  generateSeed,
  type SeedActivity,
  type SeedData,
  type SeedTask,
  type SeedTeam,
  type SeedUser,
} from '@zemp/shared/seed';

export interface MockSession {
  token: string;
  userId: string;
  csrf: string;
  expiresAt: number;
}

interface MockDb extends SeedData {
  sessions: Map<string, MockSession>;
  /** Mock only — the real API stores Argon2id hashes. */
  passwords: Map<string, string>;
  resetTokens: Map<string, { userId: string; expiresAt: number }>;
  organizationUpdatedAt: Date;
}

const store = globalThis as typeof globalThis & { __zempMockDb?: MockDb };

export function db(): MockDb {
  if (!store.__zempMockDb) {
    const seed = generateSeed();
    store.__zempMockDb = {
      ...seed,
      sessions: new Map(),
      passwords: new Map(seed.users.map((u) => [u.id, DEMO_PASSWORD])),
      resetTokens: new Map(),
      organizationUpdatedAt: seed.auditLogs[0]?.createdAt ?? new Date(),
    };
  }
  return store.__zempMockDb;
}

export const newId = () => randomUUID();
export const newToken = () => randomBytes(32).toString('base64url');
export const zone = () => db().organization.timezone;

export const findUser = (id: string) => db().users.find((u) => u.id === id);
export const findTeam = (id: string) => db().teams.find((t) => t.id === id);
export const findTask = (id: string) => db().tasks.find((t) => t.id === id);

export const userRef = (u: SeedUser): UserRef => ({
  id: u.id,
  name: u.name,
  role: u.role,
  isActive: u.isActive,
  jobTitle: u.jobTitle,
});
export const teamRef = (t: SeedTeam): TeamRef => ({ id: t.id, name: t.name });

export function currentTeam(userId: string): SeedTeam | null {
  const membership = db().memberships.find((m) => m.userId === userId && !m.leftAt);
  return membership ? (findTeam(membership.teamId) ?? null) : null;
}

export const ownedTeams = (userId: string) => db().teams.filter((t) => t.ownerId === userId && t.isActive);

/** Current members of a team whose accounts are active. */
export const teamMembers = (teamId: string) =>
  db().users.filter((u) => u.isActive && currentTeam(u.id)?.id === teamId);

export function managerOf(userId: string): SeedUser | null {
  const ownerId = currentTeam(userId)?.ownerId;
  return ownerId && ownerId !== userId ? (findUser(ownerId) ?? null) : null;
}

export const actorFor = (u: SeedUser): NamedActor => ({
  id: u.id,
  name: u.name,
  role: u.role,
  ownedTeamIds: ownedTeams(u.id).map((t) => t.id),
});

export const candidateFor = (u: SeedUser): AssigneeCandidate => ({
  id: u.id,
  name: u.name,
  role: u.role,
  isActive: u.isActive,
  teamId: currentTeam(u.id)?.id ?? null,
  ownedTeamIds: ownedTeams(u.id).map((t) => t.id),
});

export function sessionUser(u: SeedUser): SessionUser {
  const team = currentTeam(u.id);
  const manager = managerOf(u.id);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    permissions: [...ROLE_PERMISSIONS[u.role]],
    jobTitle: u.jobTitle,
    employeeCode: u.employeeCode,
    team: team ? teamRef(team) : null,
    manager: manager ? userRef(manager) : null,
    ownedTeams: ownedTeams(u.id).map(teamRef),
    organization: db().organization,
  };
}

export const visibleTasks = (actor: NamedActor) => db().tasks.filter((t) => canViewTask(actor, t));

export function summarizeTask(task: SeedTask, actor: NamedActor, now: Date): TaskSummary {
  const team = task.teamId ? findTeam(task.teamId) : undefined;
  return toTaskSummary({
    task,
    actor,
    assignee: userRef(findUser(task.assigneeId)!),
    assignor: userRef(findUser(task.assignorId)!),
    team: team ? teamRef(team) : null,
    now,
    timeZone: zone(),
  });
}

export function taskDetail(task: SeedTask, actor: NamedActor, now: Date): TaskDetail {
  return {
    ...summarizeTask(task, actor, now),
    description: task.description,
    completionNote: task.completionNote,
    createdBy: userRef(findUser(task.createdById)!),
    updatedBy: userRef(findUser(task.updatedById)!),
    commentCount: db().comments.filter((c) => c.taskId === task.id).length,
  };
}

const nameOf = (id: string) => findUser(id)?.name;

export function activityEntry(event: SeedActivity): TaskActivityEntry {
  return {
    id: event.id,
    type: event.type,
    actor: userRef(findUser(event.actorId)!),
    fromValue: event.fromValue,
    toValue: event.toValue,
    ...activityLabels(event, { user: nameOf }, zone()),
    note: event.note,
    createdAt: event.createdAt.toISOString(),
  };
}

export function addAudit(
  req: Request,
  now: Date,
  actorId: string | null,
  action: AuditAction,
  resourceType: AuditResourceType,
  resourceId: string | null,
  metadata: Record<string, unknown> | null = null,
  result: AuditResult = 'SUCCESS',
) {
  db().auditLogs.push({
    id: newId(),
    actorId,
    action,
    resourceType,
    resourceId,
    result,
    metadata,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1',
    userAgent: req.headers.get('user-agent'),
    createdAt: now,
  });
}

export function issueResetToken(userId: string, now: Date) {
  const token = newToken();
  const expiresAt = now.getTime() + 60 * 60 * 1000;
  db().resetTokens.set(token, { userId, expiresAt });
  return { token, expiresAt: new Date(expiresAt) };
}
