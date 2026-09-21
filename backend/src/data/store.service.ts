import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  DomainError,
  ROLE_PERMISSIONS,
  activityLabels,
  allowedTransitions,
  canViewPerson,
  canViewTask,
  isTeamMemberRole,
  toTaskSummary,
  type AuditAction,
  type AuditResourceType,
  type AuditResult,
  type NamedActor,
  type NotificationDraft,
  type Permission,
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
  type SeedAuditLog,
  type SeedComment,
  type SeedMembership,
  type SeedNotification,
  type SeedSnapshot,
  type SeedTask,
  type SeedTeam,
  type SeedUser,
} from '@zemp/shared/seed';
import { randomUUID } from 'node:crypto';
import { CONFIG, type AppConfig } from '../config/env.js';
import { hashPassword } from '../modules/auth/password.js';
import { EmailService } from '../modules/email/email.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';

/** The whole organization, loaded once at startup and kept in memory for reads. */
interface WorkingSet {
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

/**
 * PHASE C DATA LAYER — Postgres is the source of truth; this in-memory working set is a read
 * cache loaded once at startup (and kept current by every write going through this service). All
 * the reporting/scope logic below is unchanged from Phase B on purpose: it's plain, already-tested
 * array code, and rewriting it as a pile of individual queries would trade a working, readable
 * implementation for a riskier one without changing what it computes.
 */
@Injectable()
export class StoreService implements OnModuleInit {
  private readonly logger = new Logger(StoreService.name);
  private data!: WorkingSet;
  /** userId → argon2id hash, mirrored from the User.passwordHash column. */
  private readonly passwords = new Map<string, string>();

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly email: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const started = Date.now();
    const isEmpty = (await this.prisma.organization.findUnique({ where: { id: 'org' } })) === null;
    if (isEmpty) await this.seedDatabase();
    await this.loadFromDatabase();
    this.logger.log(
      `Loaded ${this.data.users.length} users, ${this.data.teams.length} team(s) and ${this.data.tasks.length} tasks in ${Date.now() - started}ms` +
        (isEmpty ? ' (freshly seeded)' : ''),
    );
  }

  /** First boot only: writes the deterministic demo roster into an empty database. */
  private async seedDatabase(): Promise<void> {
    const seed = generateSeed({ timeZone: this.config.ORG_TIME_ZONE });
    const hash = await hashPassword(DEMO_PASSWORD);
    await this.prisma.$transaction([
      this.prisma.organization.create({
        data: { id: 'org', name: seed.organization.name, timezone: seed.organization.timezone },
      }),
      this.prisma.user.createMany({
        data: seed.users.map((u) => ({ ...u, passwordHash: hash })),
      }),
      this.prisma.team.createMany({ data: seed.teams }),
      this.prisma.membership.createMany({ data: seed.memberships }),
    ]);
  }

  private async loadFromDatabase(): Promise<void> {
    const [org, users, teams, memberships, tasks, activities, comments, notifications, auditLogs, snapshots] =
      await Promise.all([
        this.prisma.organization.findUniqueOrThrow({ where: { id: 'org' } }),
        this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
        this.prisma.team.findMany(),
        this.prisma.membership.findMany(),
        this.prisma.task.findMany(),
        this.prisma.activity.findMany(),
        this.prisma.comment.findMany(),
        this.prisma.notification.findMany(),
        this.prisma.auditLog.findMany(),
        this.prisma.snapshot.findMany(),
      ]);

    for (const u of users) this.passwords.set(u.id, u.passwordHash);

    this.data = {
      organization: { name: org.name, timezone: org.timezone },
      users: users.map(({ passwordHash: _passwordHash, ...u }) => u) as SeedUser[],
      teams: teams as SeedTeam[],
      memberships: memberships as SeedMembership[],
      tasks: tasks as SeedTask[],
      activities: activities as SeedActivity[],
      comments: comments as SeedComment[],
      notifications: notifications.map((n) => ({ ...n, taskId: n.taskId ?? null })) as SeedNotification[],
      auditLogs: auditLogs as SeedAuditLog[],
      snapshots: snapshots as SeedSnapshot[],
    };
  }

  // ── Organization ─────────────────────────────────────────────────────────

  get organization(): { name: string; timezone: string } {
    return this.data.organization;
  }

  get timeZone(): string {
    return this.data.organization.timezone;
  }

  async updateOrganization(patch: Partial<{ name: string; timezone: string }>): Promise<void> {
    Object.assign(this.data.organization, patch);
    await this.prisma.organization.update({ where: { id: 'org' }, data: patch });
  }

  // ── Collections (read-only views over the working set) ─────────────────────

  get users(): SeedUser[] {
    return this.data.users;
  }
  get teams(): SeedTeam[] {
    return this.data.teams;
  }
  get memberships(): SeedMembership[] {
    return this.data.memberships;
  }
  get tasks(): SeedTask[] {
    return this.data.tasks;
  }
  get activities(): SeedActivity[] {
    return this.data.activities;
  }
  get comments(): SeedComment[] {
    return this.data.comments;
  }
  get notifications(): SeedNotification[] {
    return this.data.notifications;
  }
  get auditLogs(): SeedAuditLog[] {
    return this.data.auditLogs;
  }
  get snapshots(): SeedSnapshot[] {
    return this.data.snapshots;
  }

  // ── Lookups ──────────────────────────────────────────────────────────────

  readonly newId = (): string => randomUUID();

  findUser(id: string): SeedUser | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  findUserByEmail(email: string): SeedUser | undefined {
    const needle = email.trim().toLowerCase();
    return this.data.users.find((u) => u.email.toLowerCase() === needle);
  }

  findTeam(id: string): SeedTeam | undefined {
    return this.data.teams.find((t) => t.id === id);
  }

  findTask(id: string): SeedTask | undefined {
    return this.data.tasks.find((t) => t.id === id);
  }

  /** The team a person currently belongs to, or null for someone with no active membership. */
  currentTeam(userId: string): SeedTeam | null {
    const membership = this.data.memberships.find((m) => m.userId === userId && !m.leftAt);
    return membership ? (this.findTeam(membership.teamId) ?? null) : null;
  }

  ownedTeams(userId: string): SeedTeam[] {
    return this.data.teams.filter((t) => t.ownerId === userId && t.isActive);
  }

  /**
   * Teams a person manages: an admin's own teams, or — for a sub admin — the one team they belong
   * to and were promoted in. Every scope rule in `@zemp/shared` reads this list.
   */
  managedTeamIds(user: SeedUser): string[] {
    if (user.role === 'SUB_ADMIN') {
      const team = this.currentTeam(user.id);
      return team && team.isActive ? [team.id] : [];
    }
    return this.ownedTeams(user.id).map((t) => t.id);
  }

  teamMembers(teamId: string): SeedUser[] {
    return this.data.users.filter((u) => u.isActive && this.currentTeam(u.id)?.id === teamId);
  }

  /** The admin a person reports to: the owner of their current team. */
  managerOf(userId: string): SeedUser | null {
    const ownerId = this.currentTeam(userId)?.ownerId;
    return ownerId && ownerId !== userId ? (this.findUser(ownerId) ?? null) : null;
  }

  /** Staff of the given teams: employees and sub admins, who stay team members after promotion. */
  staffOfTeams(teamIds: readonly string[]): SeedUser[] {
    return this.data.users.filter((u) => isTeamMemberRole(u.role) && teamIds.includes(this.currentTeam(u.id)?.id ?? ''));
  }

  // ── Actors and references ────────────────────────────────────────────────

  actorFor(user: SeedUser): NamedActor {
    return { id: user.id, name: user.name, role: user.role, ownedTeamIds: this.managedTeamIds(user) };
  }

  candidateFor(user: SeedUser) {
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      teamId: this.currentTeam(user.id)?.id ?? null,
      ownedTeamIds: this.managedTeamIds(user),
    };
  }

  userRef(user: SeedUser): UserRef {
    return { id: user.id, name: user.name, role: user.role, isActive: user.isActive, jobTitle: user.jobTitle };
  }

  teamRef(team: SeedTeam): TeamRef {
    return { id: team.id, name: team.name };
  }

  sessionUser(user: SeedUser): SessionUser {
    const team = this.currentTeam(user.id);
    const manager = this.managerOf(user.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: [...ROLE_PERMISSIONS[user.role]],
      jobTitle: user.jobTitle,
      employeeCode: user.employeeCode,
      team: team ? this.teamRef(team) : null,
      manager: manager ? this.userRef(manager) : null,
      ownedTeams: this.managedTeamIds(user)
        .map((id) => this.findTeam(id))
        .filter((t): t is SeedTeam => Boolean(t))
        .map((t) => this.teamRef(t)),
      organization: this.organization,
    };
  }

  // ── Authorization helpers ────────────────────────────────────────────────

  can(user: SeedUser, permission: Permission): boolean {
    return ROLE_PERMISSIONS[user.role].includes(permission);
  }

  requirePermission(user: SeedUser, permission: Permission): void {
    if (!this.can(user, permission)) throw new DomainError('FORBIDDEN');
  }

  /** Tasks the actor may see at all — the single funnel every list and report goes through. */
  visibleTasks(actor: NamedActor): SeedTask[] {
    return this.data.tasks.filter((t) => canViewTask(actor, t));
  }

  /** Loads a task the actor may see; anything else is indistinguishable from a missing row. */
  loadTask(actor: NamedActor, id: string): SeedTask {
    const task = this.findTask(id);
    if (!task || !canViewTask(actor, task)) throw new DomainError('TASK_NOT_FOUND');
    return task;
  }

  /** Loads a person within the viewer's scope; out-of-scope reads as not found (no existence leak). */
  loadPerson(viewer: SeedUser, id: string): SeedUser {
    const person = this.findUser(id);
    const visible =
      person &&
      canViewPerson(this.actorFor(viewer), {
        id: person.id,
        role: person.role,
        teamId: this.currentTeam(person.id)?.id ?? null,
      });
    if (!person || !visible) throw new DomainError('USER_NOT_FOUND');
    return person;
  }

  /** The assignee's role decides what a sub admin may do with a task (access.ts: canManageTask). */
  assigneeRoleOf(task: SeedTask) {
    return this.findUser(task.assigneeId)?.role ?? 'EMPLOYEE';
  }

  // ── Read models ──────────────────────────────────────────────────────────

  summarizeTask(task: SeedTask, actor: NamedActor, now: Date): TaskSummary {
    const team = task.teamId ? this.findTeam(task.teamId) : undefined;
    const reviewer = task.reviewerId ? this.findUser(task.reviewerId) : undefined;
    return toTaskSummary({
      task,
      actor,
      assignee: this.userRef(this.findUser(task.assigneeId)!),
      assignor: this.userRef(this.findUser(task.assignorId)!),
      team: team ? this.teamRef(team) : null,
      reviewer: reviewer ? this.userRef(reviewer) : null,
      now,
      timeZone: this.timeZone,
    });
  }

  taskDetail(task: SeedTask, actor: NamedActor, now: Date): TaskDetail {
    return {
      ...this.summarizeTask(task, actor, now),
      description: task.description,
      completionNote: task.completionNote,
      createdBy: this.userRef(this.findUser(task.createdById)!),
      updatedBy: this.userRef(this.findUser(task.updatedById)!),
      commentCount: this.data.comments.filter((c) => c.taskId === task.id).length,
    };
  }

  activityEntry(event: SeedActivity): TaskActivityEntry {
    return {
      id: event.id,
      type: event.type,
      actor: this.userRef(this.findUser(event.actorId)!),
      fromValue: event.fromValue,
      toValue: event.toValue,
      ...activityLabels(event, { user: (id) => this.findUser(id)?.name }, this.timeZone),
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    };
  }

  allowedTransitionsFor(actor: NamedActor, task: SeedTask) {
    return allowedTransitions(actor, task, this.assigneeRoleOf(task));
  }

  // ── Writes: users, teams, memberships, tasks ────────────────────────────────
  //
  // Callers mutate the in-memory row (or build a new one) then await the matching save*/create*
  // call, which upserts it into Postgres. Keeping the in-memory array as the read source (rather
  // than re-querying after every write) is what lets every read model above stay synchronous.

  async createUser(user: SeedUser, passwordHash: string): Promise<void> {
    this.data.users.push(user);
    this.passwords.set(user.id, passwordHash);
    await this.prisma.user.create({ data: { ...user, passwordHash } });
  }

  async saveUser(user: SeedUser): Promise<void> {
    await this.prisma.user.update({ where: { id: user.id }, data: { ...user, id: undefined } });
  }

  async createTeam(team: SeedTeam): Promise<void> {
    this.data.teams.push(team);
    await this.prisma.team.create({ data: team });
  }

  async saveTeam(team: SeedTeam): Promise<void> {
    await this.prisma.team.update({ where: { id: team.id }, data: { ...team, id: undefined } });
  }

  async createMembership(membership: SeedMembership): Promise<void> {
    this.data.memberships.push(membership);
    await this.prisma.membership.create({ data: membership });
  }

  async saveMembership(membership: SeedMembership): Promise<void> {
    await this.prisma.membership.update({ where: { id: membership.id }, data: { leftAt: membership.leftAt } });
  }

  async createTask(task: SeedTask): Promise<void> {
    this.data.tasks.push(task);
    await this.prisma.task.create({ data: { ...task, id: task.id } });
  }

  async saveTask(task: SeedTask): Promise<void> {
    await this.prisma.task.update({ where: { id: task.id }, data: { ...task, id: undefined } });
  }

  // ── Writes: activity, notifications, audit ──────────────────────────────────

  async addActivity(
    taskId: string,
    actorId: string,
    draft: Omit<SeedActivity, 'id' | 'taskId' | 'actorId' | 'createdAt'>,
    at: Date,
  ): Promise<void> {
    const entry: SeedActivity = { id: this.newId(), taskId, actorId, ...draft, createdAt: at };
    this.data.activities.push(entry);
    await this.prisma.activity.create({ data: entry });
  }

  async addNotification(draft: NotificationDraft, taskId: string | null, at: Date): Promise<void> {
    const entry: SeedNotification = { id: this.newId(), ...draft, taskId, readAt: null, createdAt: at };
    this.data.notifications.unshift(entry);
    await this.prisma.notification.create({ data: entry });
    const recipient = this.findUser(draft.userId);
    if (recipient) this.email.send(recipient.email, draft.title, draft.body);
  }

  async markNotificationRead(id: string, at: Date): Promise<void> {
    await this.prisma.notification.update({ where: { id }, data: { readAt: at } });
  }

  async markAllNotificationsRead(userId: string, at: Date): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: at } });
  }

  /**
   * Audit entries are append-only (requirements §20): nothing in the API updates or deletes one.
   * The IP and user agent come from the request so a security review can trace who did what.
   */
  async addAudit(entry: {
    actorId: string | null;
    action: AuditAction;
    resourceType: AuditResourceType;
    resourceId: string | null;
    at: Date;
    metadata?: Record<string, unknown> | null;
    result?: AuditResult;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    const row: SeedAuditLog = {
      id: this.newId(),
      actorId: entry.actorId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      result: entry.result ?? 'SUCCESS',
      metadata: entry.metadata ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      createdAt: entry.at,
    };
    this.data.auditLogs.push(row);
    await this.prisma.auditLog.create({
      data: { ...row, metadata: (row.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull },
    });
  }

  async addComment(comment: SeedComment): Promise<void> {
    this.data.comments.push(comment);
    await this.prisma.comment.create({ data: comment });
  }

  // ── Credentials ──────────────────────────────────────────────────────────

  passwordHash(userId: string): string | undefined {
    return this.passwords.get(userId);
  }

  async setPasswordHash(userId: string, hash: string): Promise<void> {
    this.passwords.set(userId, hash);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
  }
}

export type {
  SeedActivity,
  SeedAuditLog,
  SeedComment,
  SeedMembership,
  SeedNotification,
  SeedSnapshot,
  SeedTask,
  SeedTeam,
  SeedUser,
};
