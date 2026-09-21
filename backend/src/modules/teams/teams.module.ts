import { Body, Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DomainError,
  ROLE_PERMISSIONS,
  addTeamMemberSchema,
  canDelegateRole,
  canViewTask,
  canViewTeam,
  createTeamSchema,
  listTeamsQuerySchema,
  summarizeWorkload,
  toPersonProgress,
  updateTeamSchema,
  workloadRisk,
  type AddTeamMemberInput,
  type CreateTeamInput,
  type ListTeamsQuery,
  type OrgChart,
  type OrgChartTeam,
  type TeamDetail,
  type TeamListItem,
  type TeamMemberItem,
  type UpdateTeamInput,
} from '@zemp/shared';
import { ClientInfo, CurrentUser, Now, RequirePermissions } from '../../common/auth.js';
import { FieldError, Paged, paginate, zodPipe } from '../../common/http.js';
import { StoreService, type SeedTeam, type SeedUser } from '../../data/store.service.js';
import type { ClientContext } from '../auth/auth.service.js';

@Injectable()
export class TeamsService {
  constructor(private readonly store: StoreService) {}

  private teamItem(team: SeedTeam, now: Date): TeamListItem {
    const tz = this.store.timeZone;
    const tasks = this.store.tasks.filter((t) => t.teamId === team.id);
    const members = this.store.teamMembers(team.id);
    const owner = team.ownerId ? this.store.findUser(team.ownerId) : undefined;
    const atRiskMembers = members.filter((m) => {
      const risk = workloadRisk(
        tasks.filter((t) => t.assigneeId === m.id),
        now,
        tz,
      );
      return risk === 'AT_RISK' || risk === 'OVERDUE';
    }).length;
    return {
      id: team.id,
      name: team.name,
      description: team.description,
      isActive: team.isActive,
      owner: owner ? this.store.userRef(owner) : null,
      memberCount: members.length,
      workload: summarizeWorkload(tasks, now, tz),
      atRiskMembers,
      risk: workloadRisk(tasks, now, tz),
      createdAt: team.createdAt.toISOString(),
    };
  }

  private detail(team: SeedTeam, viewer: SeedUser, now: Date): TeamDetail {
    return {
      ...this.teamItem(team, now),
      permissions: { canEdit: viewer.role === 'SUPER_ADMIN', canManageMembers: viewer.role === 'SUPER_ADMIN' },
    };
  }

  /** Out-of-scope teams read as missing, so team ids cannot be probed. */
  private load(viewer: SeedUser, id: string): SeedTeam {
    const team = this.store.findTeam(id);
    if (!team || !canViewTeam(this.store.actorFor(viewer), team.id)) throw new DomainError('TEAM_NOT_FOUND');
    return team;
  }

  private assertOwner(ownerId: string | null | undefined): void {
    if (!ownerId) return;
    const owner = this.store.findUser(ownerId);
    if (!owner || owner.role !== 'ADMIN' || !owner.isActive) {
      throw new FieldError('INVALID_REFERENCE', 'ownerId', 'Choose an active admin.');
    }
  }

  private assertUniqueName(name: string | undefined, exceptId?: string): void {
    if (name && this.store.teams.some((t) => t.id !== exceptId && t.name.toLowerCase() === name.toLowerCase())) {
      throw new FieldError('TEAM_NAME_TAKEN', 'name');
    }
  }

  list(viewer: SeedUser, query: ListTeamsQuery, now: Date): Paged<TeamListItem> {
    const search = query.search?.toLowerCase();
    const scope =
      viewer.role === 'SUPER_ADMIN'
        ? this.store.teams
        : this.store
            .managedTeamIds(viewer)
            .map((id) => this.store.findTeam(id))
            .filter((t): t is SeedTeam => Boolean(t));
    const teams = scope.filter(
      (t) =>
        (!search || t.name.toLowerCase().includes(search)) && (!query.status || t.isActive === (query.status === 'active')),
    );
    const direction = query.order === 'asc' ? 1 : -1;
    teams.sort(
      (a, b) =>
        (query.sort === 'createdAt' ? a.createdAt.getTime() - b.createdAt.getTime() : a.name.localeCompare(b.name)) *
        direction,
    );
    const page = paginate(teams, query.page, query.pageSize);
    return new Paged(
      page.items.map((t) => this.teamItem(t, now)),
      page.meta,
    );
  }

  async create(viewer: SeedUser, input: CreateTeamInput, client: ClientContext, now: Date): Promise<TeamDetail> {
    this.assertUniqueName(input.name);
    this.assertOwner(input.ownerId);
    const team: SeedTeam = {
      id: this.store.newId(),
      name: input.name,
      description: input.description || null,
      ownerId: input.ownerId ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.createTeam(team);
    await this.store.addAudit({
      actorId: viewer.id,
      action: 'TEAM_CREATED',
      resourceType: 'TEAM',
      resourceId: team.id,
      at: now,
      metadata: { name: team.name, ownerId: team.ownerId },
      ...client,
    });
    return this.detail(team, viewer, now);
  }

  get(viewer: SeedUser, id: string, now: Date): TeamDetail {
    return this.detail(this.load(viewer, id), viewer, now);
  }

  async update(viewer: SeedUser, id: string, input: UpdateTeamInput, client: ClientContext, now: Date): Promise<TeamDetail> {
    const team = this.load(viewer, id);
    this.assertUniqueName(input.name, team.id);
    this.assertOwner(input.ownerId);
    if (input.isActive === false && this.store.teamMembers(team.id).length > 0) {
      throw new DomainError('TEAM_HAS_ACTIVE_MEMBERS');
    }
    const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    Object.assign(team, changes, { updatedAt: now });
    await this.store.saveTeam(team);
    await this.store.addAudit({
      actorId: viewer.id,
      action: 'TEAM_UPDATED',
      resourceType: 'TEAM',
      resourceId: team.id,
      at: now,
      metadata: { fields: Object.keys(changes) },
      ...client,
    });
    return this.detail(team, viewer, now);
  }

  members(viewer: SeedUser, id: string, now: Date): TeamMemberItem[] {
    const team = this.load(viewer, id);
    const actor = this.store.actorFor(viewer);
    const tz = this.store.timeZone;
    return this.store.users
      .filter((u) => this.store.currentTeam(u.id)?.id === team.id)
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name))
      .map((u): TeamMemberItem => {
        const tasks = this.store.tasks.filter((t) => t.assigneeId === u.id && canViewTask(actor, t));
        const progress = toPersonProgress({
          user: this.store.userRef(u),
          team: this.store.teamRef(team),
          tasks,
          now,
          timeZone: tz,
        });
        const membership = this.store.memberships.find((m) => m.userId === u.id && !m.leftAt)!;
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          employeeCode: u.employeeCode,
          jobTitle: u.jobTitle,
          role: u.role,
          isActive: u.isActive,
          joinedAt: membership.joinedAt.toISOString(),
          canDelegate:
            ROLE_PERMISSIONS[viewer.role].includes('users.delegate') &&
            canDelegateRole(actor, { id: u.id, role: u.role, teamId: team.id }),
          workload: progress.workload,
          risk: progress.risk,
        };
      });
  }

  async addMember(viewer: SeedUser, id: string, input: AddTeamMemberInput, client: ClientContext, now: Date): Promise<TeamDetail> {
    const team = this.load(viewer, id);
    if (!team.isActive) throw new DomainError('INVALID_TEAM', 'This team is inactive.');
    const person = this.store.findUser(input.userId);
    if (!person || person.role !== 'EMPLOYEE') {
      throw new FieldError('INVALID_REFERENCE', 'userId', 'Choose an employee.');
    }
    const from = this.store.currentTeam(person.id);
    if (from?.id !== team.id) {
      for (const membership of this.store.memberships) {
        if (membership.userId === person.id && !membership.leftAt) {
          membership.leftAt = now;
          await this.store.saveMembership(membership);
        }
      }
      await this.store.createMembership({
        id: this.store.newId(),
        teamId: team.id,
        userId: person.id,
        joinedAt: now,
        leftAt: null,
      });
      await this.store.addAudit({
        actorId: viewer.id,
        action: 'TEAM_MEMBER_MOVED',
        resourceType: 'USER',
        resourceId: person.id,
        at: now,
        metadata: { fromTeamId: from?.id ?? null, toTeamId: team.id },
        ...client,
      });
    }
    return this.detail(team, viewer, now);
  }

  /** The organization chart: Super Admin only, since it spans every team. */
  orgChart(viewer: SeedUser): OrgChart {
    if (viewer.role !== 'SUPER_ADMIN') throw new DomainError('FORBIDDEN');
    const chartTeam = (t: SeedTeam): OrgChartTeam => ({
      ...this.store.teamRef(t),
      isActive: t.isActive,
      memberCount: this.store.teamMembers(t.id).length,
    });
    const admins = this.store.users.filter((u) => u.role === 'ADMIN');
    return {
      superAdmins: this.store.users.filter((u) => u.role === 'SUPER_ADMIN').map((u) => this.store.userRef(u)),
      admins: admins
        .map((admin) => {
          const teams = this.store.teams.filter((t) => t.ownerId === admin.id).map(chartTeam);
          return {
            ...this.store.userRef(admin),
            teams,
            employeeCount: teams.reduce((sum, t) => sum + t.memberCount, 0),
          };
        })
        .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)),
      unownedTeams: this.store.teams.filter((t) => !t.ownerId).map(chartTeam),
      totals: {
        admins: admins.length,
        employees: this.store.users.filter((u) => u.role === 'EMPLOYEE' || u.role === 'SUB_ADMIN').length,
        teams: this.store.teams.filter((t) => t.isActive).length,
      },
    };
  }
}

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @RequirePermissions('teams.read')
  @ApiOperation({ summary: 'Teams within scope' })
  list(
    @CurrentUser() user: SeedUser,
    @Query(zodPipe(listTeamsQuerySchema)) query: ListTeamsQuery,
    @Now() now: Date,
  ): Paged<TeamListItem> {
    return this.teams.list(user, query, now);
  }

  @Post()
  @RequirePermissions('teams.create')
  @ApiOperation({ summary: 'Create a team' })
  create(
    @CurrentUser() user: SeedUser,
    @Body(zodPipe(createTeamSchema)) input: CreateTeamInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<TeamDetail> {
    return this.teams.create(user, input, client, now);
  }

  @Get(':id')
  @RequirePermissions('teams.read')
  @ApiOperation({ summary: 'One team' })
  get(@CurrentUser() user: SeedUser, @Param('id', ParseUUIDPipe) id: string, @Now() now: Date): TeamDetail {
    return this.teams.get(user, id, now);
  }

  @Patch(':id')
  @RequirePermissions('teams.update')
  @ApiOperation({ summary: 'Edit a team, its owner, or deactivate it' })
  update(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(updateTeamSchema)) input: UpdateTeamInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<TeamDetail> {
    return this.teams.update(user, id, input, client, now);
  }

  @Get(':id/members')
  @RequirePermissions('teams.read')
  @ApiOperation({ summary: 'Members of a team with their workload' })
  members(@CurrentUser() user: SeedUser, @Param('id', ParseUUIDPipe) id: string, @Now() now: Date): TeamMemberItem[] {
    return this.teams.members(user, id, now);
  }

  @Post(':id/members')
  @RequirePermissions('users.update')
  @ApiOperation({ summary: 'Move an employee into this team' })
  addMember(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(addTeamMemberSchema)) input: AddTeamMemberInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<TeamDetail> {
    return this.teams.addMember(user, id, input, client, now);
  }
}

@ApiTags('teams')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly teams: TeamsService) {}

  @Get('chart')
  @RequirePermissions('teams.read')
  @ApiOperation({ summary: 'Who reports to whom across the organization' })
  chart(@CurrentUser() user: SeedUser): OrgChart {
    return this.teams.orgChart(user);
  }
}

@Module({
  controllers: [TeamsController, OrganizationController],
  providers: [TeamsService],
})
export class TeamsModule {}
