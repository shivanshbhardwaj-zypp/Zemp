import { Injectable } from '@nestjs/common';
import {
  DomainError,
  OPEN_TASK_STATUSES,
  canDelegateRole,
  canViewTask,
  countInDay,
  isTeamMemberRole,
  planRoleChange,
  summarizeWorkload,
  workloadRisk,
  type AdminListItem,
  type ChangeRoleInput,
  type CreateAdminInput,
  type CreateEmployeeInput,
  type EmployeeDetail,
  type EmployeeListItem,
  type ListPeopleQuery,
  type NamedActor,
  type PasswordResetIssued,
  type PeopleStats,
  type UpdateAdminInput,
  type UpdateEmployeeInput,
} from '@zemp/shared';
import { FieldError, Paged, paginate } from '../../common/http.js';
import { StoreService, type SeedUser } from '../../data/store.service.js';
import { AuthService, type ClientContext } from '../auth/auth.service.js';
import { hashPassword } from '../auth/password.js';

/** People: employees, admins, account status and the Sub Admin delegation. */
@Injectable()
export class PeopleService {
  constructor(
    private readonly store: StoreService,
    private readonly auth: AuthService,
  ) {}

  private tasksFor(userId: string, actor: NamedActor) {
    return this.store.tasks.filter((t) => t.assigneeId === userId && canViewTask(actor, t));
  }

  private employeeItem(user: SeedUser, actor: NamedActor, now: Date): EmployeeListItem {
    const team = this.store.currentTeam(user.id);
    const manager = this.store.managerOf(user.id);
    const tasks = this.tasksFor(user.id, actor);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employeeCode,
      jobTitle: user.jobTitle,
      role: user.role,
      isActive: user.isActive,
      team: team ? this.store.teamRef(team) : null,
      manager: manager ? this.store.userRef(manager) : null,
      workload: summarizeWorkload(tasks, now, this.store.timeZone),
      risk: workloadRisk(tasks, now, this.store.timeZone),
      createdAt: user.createdAt.toISOString(),
    };
  }

  private employeeDetail(user: SeedUser, viewer: SeedUser, now: Date): EmployeeDetail {
    const actor = this.store.actorFor(viewer);
    const manageable = viewer.role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN';
    const tasks = this.tasksFor(user.id, actor);
    return {
      ...this.employeeItem(user, actor, now),
      phone: user.phone,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      ownedTeams: this.store.ownedTeams(user.id).map((t) => this.store.teamRef(t)),
      completedToday: countInDay(
        tasks.map((t) => (t.status === 'COMPLETED' ? t.completedAt : null)),
        now,
        this.store.timeZone,
      ),
      permissions: {
        canEdit: manageable,
        canChangeStatus: manageable && user.id !== viewer.id,
        canResetPassword: manageable,
        canDelegate:
          this.store.can(viewer, 'users.delegate') &&
          canDelegateRole(actor, {
            id: user.id,
            role: user.role,
            teamId: this.store.currentTeam(user.id)?.id ?? null,
          }),
      },
    };
  }

  /**
   * Team managers see the staff of the teams they manage; the Super Admin sees everyone. "Staff"
   * covers employees and sub admins, who stay team members after promotion.
   */
  private peopleInScope(viewer: SeedUser, kind: 'STAFF' | 'ADMIN'): SeedUser[] {
    const managed = this.store.managedTeamIds(viewer);
    const matches = (u: SeedUser) => (kind === 'ADMIN' ? u.role === 'ADMIN' : isTeamMemberRole(u.role));
    return this.store.users.filter(
      (u) => matches(u) && (viewer.role === 'SUPER_ADMIN' || managed.includes(this.store.currentTeam(u.id)?.id ?? '')),
    );
  }

  private assertUnique(email: string | undefined, employeeCode: string | undefined, exceptId?: string): void {
    const others = this.store.users.filter((u) => u.id !== exceptId);
    if (email && others.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new FieldError('EMAIL_TAKEN', 'email');
    }
    if (employeeCode && others.some((u) => u.employeeCode === employeeCode)) {
      throw new FieldError('EMPLOYEE_CODE_TAKEN', 'employeeCode');
    }
  }

  private listPeople(viewer: SeedUser, kind: 'STAFF' | 'ADMIN', query: ListPeopleQuery) {
    const search = query.search?.toLowerCase();
    const people = this.peopleInScope(viewer, kind).filter(
      (u) =>
        (!search || [u.name, u.email, u.employeeCode].some((value) => value.toLowerCase().includes(search))) &&
        (!query.status || u.isActive === (query.status === 'active')) &&
        (!query.teamId ||
          (kind === 'ADMIN'
            ? this.store.ownedTeams(u.id).some((t) => t.id === query.teamId)
            : this.store.currentTeam(u.id)?.id === query.teamId)),
    );
    const direction = query.order === 'asc' ? 1 : -1;
    people.sort(
      (a, b) =>
        (query.sort === 'createdAt'
          ? a.createdAt.getTime() - b.createdAt.getTime()
          : a[query.sort].localeCompare(b[query.sort])) * direction,
    );
    return paginate(people, query.page, query.pageSize);
  }

  employees(viewer: SeedUser, query: ListPeopleQuery, now: Date): Paged<EmployeeListItem> {
    const actor = this.store.actorFor(viewer);
    const page = this.listPeople(viewer, 'STAFF', query);
    return new Paged(
      page.items.map((u) => this.employeeItem(u, actor, now)),
      page.meta,
    );
  }

  stats(viewer: SeedUser): PeopleStats {
    const people = this.peopleInScope(viewer, 'STAFF');
    const active = people.filter((u) => u.isActive);
    const actor = this.store.actorFor(viewer);
    const openTasks = active.reduce(
      (sum, u) => sum + this.tasksFor(u.id, actor).filter((t) => OPEN_TASK_STATUSES.includes(t.status)).length,
      0,
    );
    return {
      total: people.length,
      active: active.length,
      inactive: people.length - active.length,
      teams:
        viewer.role === 'SUPER_ADMIN'
          ? this.store.teams.filter((t) => t.isActive).length
          : this.store.managedTeamIds(viewer).length,
      averageActiveTasks: active.length ? Math.round((openTasks / active.length) * 10) / 10 : 0,
    };
  }

  employee(viewer: SeedUser, id: string, now: Date): EmployeeDetail {
    return this.employeeDetail(this.store.loadPerson(viewer, id), viewer, now);
  }

  async createEmployee(
    viewer: SeedUser,
    input: CreateEmployeeInput,
    client: ClientContext,
    now: Date,
  ): Promise<EmployeeDetail> {
    this.assertUnique(input.email, input.employeeCode);
    const team = this.store.findTeam(input.teamId);
    if (!team?.isActive) throw new FieldError('INVALID_TEAM', 'teamId', 'Choose an active team.');

    const employee: SeedUser = {
      id: this.store.newId(),
      email: input.email,
      name: input.name,
      role: 'EMPLOYEE',
      isActive: true,
      jobTitle: input.jobTitle,
      employeeCode: input.employeeCode,
      phone: null,
      createdAt: now,
      lastLoginAt: null,
    };
    await this.store.createUser(employee, await hashPassword(input.password));
    await this.store.createMembership({
      id: this.store.newId(),
      teamId: team.id,
      userId: employee.id,
      joinedAt: now,
      leftAt: null,
    });
    await this.store.addAudit({
      actorId: viewer.id,
      action: 'USER_CREATED',
      resourceType: 'USER',
      resourceId: employee.id,
      at: now,
      metadata: { role: 'EMPLOYEE', teamId: team.id },
      ...client,
    });
    return this.employeeDetail(employee, viewer, now);
  }

  private async moveToTeam(person: SeedUser, teamId: string, actorId: string, client: ClientContext, now: Date): Promise<void> {
    const from = this.store.currentTeam(person.id);
    if (from?.id === teamId) return;
    const team = this.store.findTeam(teamId);
    if (!team?.isActive) throw new FieldError('INVALID_TEAM', 'teamId', 'Choose an active team.');
    for (const membership of this.store.memberships) {
      if (membership.userId === person.id && !membership.leftAt) {
        membership.leftAt = now;
        await this.store.saveMembership(membership);
      }
    }
    await this.store.createMembership({ id: this.store.newId(), teamId, userId: person.id, joinedAt: now, leftAt: null });
    await this.store.addAudit({
      actorId,
      action: 'TEAM_MEMBER_MOVED',
      resourceType: 'USER',
      resourceId: person.id,
      at: now,
      metadata: { fromTeamId: from?.id ?? null, toTeamId: teamId },
      ...client,
    });
  }

  async updateEmployee(
    viewer: SeedUser,
    id: string,
    input: UpdateEmployeeInput,
    client: ClientContext,
    now: Date,
  ): Promise<EmployeeDetail> {
    const person = this.store.loadPerson(viewer, id);
    if (!isTeamMemberRole(person.role)) throw new DomainError('USER_NOT_FOUND');
    this.assertUnique(input.email, input.employeeCode, person.id);
    if (input.teamId) await this.moveToTeam(person, input.teamId, viewer.id, client, now);

    const fields = (['name', 'email', 'employeeCode', 'jobTitle'] as const).filter(
      (key) => input[key] !== undefined && input[key] !== person[key],
    );
    for (const key of fields) person[key] = input[key]!;
    if (fields.length) {
      await this.store.saveUser(person);
      await this.store.addAudit({
        actorId: viewer.id,
        action: 'USER_UPDATED',
        resourceType: 'USER',
        resourceId: person.id,
        at: now,
        metadata: { fields },
        ...client,
      });
    }
    return this.employeeDetail(person, viewer, now);
  }

  /** Promote a team member to Sub Admin, or return them to Employee. */
  async changeRole(
    viewer: SeedUser,
    id: string,
    input: ChangeRoleInput,
    client: ClientContext,
    now: Date,
  ): Promise<EmployeeDetail> {
    const person = this.store.loadPerson(viewer, id);
    const team = this.store.currentTeam(person.id);
    const plan = planRoleChange({
      actor: this.store.actorFor(viewer),
      person: {
        id: person.id,
        name: person.name,
        role: person.role,
        teamId: team?.id ?? null,
        isActive: person.isActive,
      },
      to: input.role,
      teamName: team?.name,
    });
    person.role = plan.patch.role;
    await this.store.saveUser(person);
    for (const notification of plan.notifications) await this.store.addNotification(notification, null, now);
    for (const entry of plan.audits) {
      await this.store.addAudit({
        actorId: viewer.id,
        action: entry.action,
        resourceType: 'USER',
        resourceId: person.id,
        at: now,
        metadata: entry.metadata,
        ...client,
      });
    }
    return this.employeeDetail(person, viewer, now);
  }

  // ── Admins ───────────────────────────────────────────────────────────────

  private adminItem(admin: SeedUser, viewer: SeedUser, now: Date): AdminListItem {
    const teams = this.store.ownedTeams(admin.id);
    const tasks = this.tasksFor(admin.id, this.store.actorFor(viewer));
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      employeeCode: admin.employeeCode,
      jobTitle: admin.jobTitle,
      isActive: admin.isActive,
      teams: teams.map((t) => this.store.teamRef(t)),
      employeeCount: teams.reduce((sum, t) => sum + this.store.teamMembers(t.id).length, 0),
      workload: summarizeWorkload(tasks, now, this.store.timeZone),
      risk: workloadRisk(tasks, now, this.store.timeZone),
      createdAt: admin.createdAt.toISOString(),
    };
  }

  admins(viewer: SeedUser, query: ListPeopleQuery, now: Date): Paged<AdminListItem> {
    if (viewer.role !== 'SUPER_ADMIN') throw new DomainError('FORBIDDEN');
    const page = this.listPeople(viewer, 'ADMIN', query);
    return new Paged(
      page.items.map((a) => this.adminItem(a, viewer, now)),
      page.meta,
    );
  }

  private async assignTeams(admin: SeedUser, teamIds: string[], actorId: string, client: ClientContext, now: Date): Promise<void> {
    if (teamIds.some((id) => !this.store.findTeam(id))) {
      throw new FieldError('INVALID_TEAM', 'teamIds', 'One of the selected teams no longer exists.');
    }
    for (const team of this.store.teams) {
      const shouldOwn = teamIds.includes(team.id);
      if (shouldOwn === (team.ownerId === admin.id)) continue;
      team.ownerId = shouldOwn ? admin.id : null;
      team.updatedAt = now;
      await this.store.saveTeam(team);
      await this.store.addAudit({
        actorId,
        action: 'TEAM_UPDATED',
        resourceType: 'TEAM',
        resourceId: team.id,
        at: now,
        metadata: { ownerId: team.ownerId },
        ...client,
      });
    }
  }

  async createAdmin(viewer: SeedUser, input: CreateAdminInput, client: ClientContext, now: Date): Promise<AdminListItem> {
    this.assertUnique(input.email, input.employeeCode);
    const admin: SeedUser = {
      id: this.store.newId(),
      email: input.email,
      name: input.name,
      role: 'ADMIN',
      isActive: true,
      jobTitle: input.jobTitle,
      employeeCode: input.employeeCode,
      phone: null,
      createdAt: now,
      lastLoginAt: null,
    };
    await this.store.createUser(admin, await hashPassword(input.password));
    await this.assignTeams(admin, input.teamIds ?? [], viewer.id, client, now);
    await this.store.addAudit({
      actorId: viewer.id,
      action: 'USER_CREATED',
      resourceType: 'USER',
      resourceId: admin.id,
      at: now,
      metadata: { role: 'ADMIN', teamIds: input.teamIds },
      ...client,
    });
    return this.adminItem(admin, viewer, now);
  }

  async updateAdmin(viewer: SeedUser, id: string, input: UpdateAdminInput, client: ClientContext, now: Date): Promise<AdminListItem> {
    const admin = this.store.findUser(id);
    if (!admin || admin.role !== 'ADMIN') throw new DomainError('USER_NOT_FOUND');
    this.assertUnique(input.email, input.employeeCode, admin.id);
    if (input.teamIds) await this.assignTeams(admin, input.teamIds, viewer.id, client, now);

    const fields = (['name', 'email', 'employeeCode', 'jobTitle'] as const).filter(
      (key) => input[key] !== undefined && input[key] !== admin[key],
    );
    for (const key of fields) admin[key] = input[key]!;
    if (fields.length) {
      await this.store.saveUser(admin);
      await this.store.addAudit({
        actorId: viewer.id,
        action: 'USER_UPDATED',
        resourceType: 'USER',
        resourceId: admin.id,
        at: now,
        metadata: { fields },
        ...client,
      });
    }
    return this.adminItem(admin, viewer, now);
  }

  // ── Account status and access ────────────────────────────────────────────

  async setActive(viewer: SeedUser, id: string, isActive: boolean, client: ClientContext, now: Date): Promise<EmployeeDetail> {
    if (viewer.role !== 'SUPER_ADMIN') throw new DomainError('FORBIDDEN');
    const person = this.store.findUser(id);
    if (!person || person.role === 'SUPER_ADMIN') throw new DomainError('USER_NOT_FOUND');
    if (person.id === viewer.id) throw new DomainError('CANNOT_CHANGE_OWN_ACCOUNT');

    person.isActive = isActive;
    await this.store.saveUser(person);
    await this.store.addAudit({
      actorId: viewer.id,
      action: isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
      resourceType: 'USER',
      resourceId: person.id,
      at: now,
      ...client,
    });
    return this.employeeDetail(person, viewer, now);
  }

  /** Issues a single-use reset link for someone else; the admin never sees their password. */
  async issuePasswordReset(viewer: SeedUser, id: string, client: ClientContext, now: Date): Promise<PasswordResetIssued> {
    if (viewer.role !== 'SUPER_ADMIN') throw new DomainError('FORBIDDEN');
    const person = this.store.findUser(id);
    if (!person || person.role === 'SUPER_ADMIN') throw new DomainError('USER_NOT_FOUND');
    const token = await this.auth.issueResetToken(person.id, now);
    await this.store.addAudit({
      actorId: viewer.id,
      action: 'PASSWORD_RESET_ISSUED',
      resourceType: 'USER',
      resourceId: person.id,
      at: now,
      ...client,
    });
    return {
      resetUrl: `/reset-password?token=${token}`,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    };
  }
}
