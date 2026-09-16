/** PHASE A MOCK — employees, admins and account administration. */
import {
  DomainError,
  OPEN_TASK_STATUSES,
  canViewPerson,
  canViewTask,
  countInDay,
  createAdminSchema,
  createEmployeeSchema,
  listPeopleQuerySchema,
  summarizeWorkload,
  updateAdminSchema,
  updateEmployeeSchema,
  workloadRisk,
  type AdminListItem,
  type EmployeeDetail,
  type EmployeeListItem,
  type NamedActor,
  type PasswordResetIssued,
  type PeopleStats,
} from '@zemp/shared';
import type { SeedUser } from '@zemp/shared/seed';
import {
  actorFor,
  addAudit,
  currentTeam,
  db,
  findTeam,
  findUser,
  issueResetToken,
  managerOf,
  newId,
  ownedTeams,
  teamMembers,
  teamRef,
  userRef,
  zone,
} from '../db';
import { Paged, fieldError, get, paginate, parse, patch, post, requirePermission } from '../http';

const tasksFor = (userId: string, actor: NamedActor) =>
  db().tasks.filter((t) => t.assigneeId === userId && canViewTask(actor, t));

function employeeItem(u: SeedUser, actor: NamedActor, now: Date): EmployeeListItem {
  const team = currentTeam(u.id);
  const manager = managerOf(u.id);
  const tasks = tasksFor(u.id, actor);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    employeeCode: u.employeeCode,
    jobTitle: u.jobTitle,
    role: u.role,
    isActive: u.isActive,
    team: team ? teamRef(team) : null,
    manager: manager ? userRef(manager) : null,
    workload: summarizeWorkload(tasks, now, zone()),
    risk: workloadRisk(tasks, now, zone()),
    createdAt: u.createdAt.toISOString(),
  };
}

function employeeDetail(u: SeedUser, viewer: SeedUser, now: Date): EmployeeDetail {
  const actor = actorFor(viewer);
  const manageable = viewer.role === 'SUPER_ADMIN' && u.role !== 'SUPER_ADMIN';
  const tasks = tasksFor(u.id, actor);
  return {
    ...employeeItem(u, actor, now),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    ownedTeams: ownedTeams(u.id).map(teamRef),
    completedToday: countInDay(tasks.map((t) => (t.status === 'COMPLETED' ? t.completedAt : null)), now, zone()),
    permissions: { canEdit: manageable, canChangeStatus: manageable && u.id !== viewer.id, canResetPassword: manageable },
  };
}

/** Admins see employees of the teams they own; the Super Admin sees everyone. */
function peopleInScope(viewer: SeedUser, role: 'EMPLOYEE' | 'ADMIN') {
  const owned = ownedTeams(viewer.id).map((t) => t.id);
  return db().users.filter(
    (u) => u.role === role && (viewer.role === 'SUPER_ADMIN' || owned.includes(currentTeam(u.id)?.id ?? '')),
  );
}

function assertUnique(email: string | undefined, employeeCode: string | undefined, exceptId?: string) {
  const others = db().users.filter((u) => u.id !== exceptId);
  if (email && others.some((u) => u.email === email)) throw fieldError('EMAIL_TAKEN', 'email');
  if (employeeCode && others.some((u) => u.employeeCode === employeeCode)) {
    throw fieldError('EMPLOYEE_CODE_TAKEN', 'employeeCode');
  }
}

function listPeople(viewer: SeedUser, role: 'EMPLOYEE' | 'ADMIN', query: Record<string, string>) {
  const q = parse(listPeopleQuerySchema, query);
  const search = q.search?.toLowerCase();
  const people = peopleInScope(viewer, role).filter(
    (u) =>
      (!search || [u.name, u.email, u.employeeCode].some((v) => v.toLowerCase().includes(search))) &&
      (!q.status || u.isActive === (q.status === 'active')) &&
      (!q.teamId ||
        (role === 'ADMIN' ? ownedTeams(u.id).some((t) => t.id === q.teamId) : currentTeam(u.id)?.id === q.teamId)),
  );
  const direction = q.order === 'asc' ? 1 : -1;
  people.sort((a, b) =>
    (q.sort === 'createdAt' ? a.createdAt.getTime() - b.createdAt.getTime() : a[q.sort].localeCompare(b[q.sort])) * direction,
  );
  return { page: paginate(people, q.page, q.pageSize) };
}

get('/employees', ({ user, query, now }) => {
  requirePermission(user, 'users.read');
  const { page } = listPeople(user, 'EMPLOYEE', query);
  const actor = actorFor(user);
  return new Paged(page.items.map((u) => employeeItem(u, actor, now)), page.meta);
});

get('/employees/stats', ({ user }) => {
  requirePermission(user, 'users.read');
  const people = peopleInScope(user, 'EMPLOYEE');
  const active = people.filter((u) => u.isActive);
  const actor = actorFor(user);
  const openTasks = active.reduce(
    (sum, u) => sum + tasksFor(u.id, actor).filter((t) => OPEN_TASK_STATUSES.includes(t.status)).length,
    0,
  );
  return {
    total: people.length,
    active: active.length,
    inactive: people.length - active.length,
    teams: user.role === 'SUPER_ADMIN' ? db().teams.filter((t) => t.isActive).length : ownedTeams(user.id).length,
    averageActiveTasks: active.length ? Math.round((openTasks / active.length) * 10) / 10 : 0,
  } satisfies PeopleStats;
});

post('/employees', ({ req, user, body, now }) => {
  requirePermission(user, 'users.create');
  const input = parse(createEmployeeSchema, body);
  assertUnique(input.email, input.employeeCode);
  const team = findTeam(input.teamId);
  if (!team || !team.isActive) throw fieldError('INVALID_TEAM', 'teamId', 'Choose an active team.');
  const employee: SeedUser = {
    id: newId(),
    email: input.email,
    name: input.name,
    role: 'EMPLOYEE',
    isActive: true,
    jobTitle: input.jobTitle,
    employeeCode: input.employeeCode,
    createdAt: now,
    lastLoginAt: null,
  };
  const store = db();
  store.users.push(employee);
  store.passwords.set(employee.id, input.password);
  store.memberships.push({ id: newId(), teamId: team.id, userId: employee.id, joinedAt: now, leftAt: null });
  addAudit(req, now, user.id, 'USER_CREATED', 'USER', employee.id, { role: 'EMPLOYEE', teamId: team.id });
  return employeeDetail(employee, user, now);
});

function loadPerson(viewer: SeedUser, id: string) {
  const person = findUser(id);
  const visible =
    person && canViewPerson(actorFor(viewer), { id: person.id, role: person.role, teamId: currentTeam(person.id)?.id ?? null });
  if (!person || !visible) throw new DomainError('USER_NOT_FOUND');
  return person;
}

get('/employees/:id', ({ user, params, now }) => employeeDetail(loadPerson(user, params.id!), user, now));

function moveToTeam(req: Request, now: Date, actorId: string, person: SeedUser, teamId: string) {
  const store = db();
  const from = currentTeam(person.id);
  if (from?.id === teamId) return;
  const team = findTeam(teamId);
  if (!team || !team.isActive) throw fieldError('INVALID_TEAM', 'teamId', 'Choose an active team.');
  for (const membership of store.memberships) {
    if (membership.userId === person.id && !membership.leftAt) membership.leftAt = now;
  }
  store.memberships.push({ id: newId(), teamId, userId: person.id, joinedAt: now, leftAt: null });
  addAudit(req, now, actorId, 'TEAM_MEMBER_MOVED', 'USER', person.id, { fromTeamId: from?.id ?? null, toTeamId: teamId });
}

patch('/employees/:id', ({ req, user, params, body, now }) => {
  requirePermission(user, 'users.update');
  const input = parse(updateEmployeeSchema, body);
  const person = loadPerson(user, params.id!);
  if (person.role !== 'EMPLOYEE') throw new DomainError('USER_NOT_FOUND');
  assertUnique(input.email, input.employeeCode, person.id);
  if (input.teamId) moveToTeam(req, now, user.id, person, input.teamId);
  const fields = (['name', 'email', 'employeeCode', 'jobTitle'] as const).filter(
    (key) => input[key] !== undefined && input[key] !== person[key],
  );
  for (const key of fields) person[key] = input[key]!;
  if (fields.length) addAudit(req, now, user.id, 'USER_UPDATED', 'USER', person.id, { fields });
  return employeeDetail(person, user, now);
});

function adminItem(admin: SeedUser, viewer: SeedUser, now: Date): AdminListItem {
  const teams = ownedTeams(admin.id);
  const tasks = tasksFor(admin.id, actorFor(viewer));
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    employeeCode: admin.employeeCode,
    jobTitle: admin.jobTitle,
    isActive: admin.isActive,
    teams: teams.map(teamRef),
    employeeCount: teams.reduce((sum, t) => sum + teamMembers(t.id).length, 0),
    workload: summarizeWorkload(tasks, now, zone()),
    risk: workloadRisk(tasks, now, zone()),
    createdAt: admin.createdAt.toISOString(),
  };
}

function assignTeams(req: Request, now: Date, actorId: string, admin: SeedUser, teamIds: string[]) {
  if (teamIds.some((id) => !findTeam(id))) {
    throw fieldError('INVALID_TEAM', 'teamIds', 'One of the selected teams no longer exists.');
  }
  for (const team of db().teams) {
    const shouldOwn = teamIds.includes(team.id);
    if (shouldOwn === (team.ownerId === admin.id)) continue;
    team.ownerId = shouldOwn ? admin.id : null;
    team.updatedAt = now;
    addAudit(req, now, actorId, 'TEAM_UPDATED', 'TEAM', team.id, { ownerId: team.ownerId });
  }
}

get('/admins', ({ user, query, now }) => {
  if (user.role !== 'SUPER_ADMIN') throw new DomainError('FORBIDDEN');
  const { page } = listPeople(user, 'ADMIN', query);
  return new Paged(page.items.map((a) => adminItem(a, user, now)), page.meta);
});

post('/admins', ({ req, user, body, now }) => {
  requirePermission(user, 'users.create');
  const input = parse(createAdminSchema, body);
  assertUnique(input.email, input.employeeCode);
  const admin: SeedUser = {
    id: newId(),
    email: input.email,
    name: input.name,
    role: 'ADMIN',
    isActive: true,
    jobTitle: input.jobTitle,
    employeeCode: input.employeeCode,
    createdAt: now,
    lastLoginAt: null,
  };
  db().users.push(admin);
  db().passwords.set(admin.id, input.password);
  addAudit(req, now, user.id, 'USER_CREATED', 'USER', admin.id, { role: 'ADMIN', teamIds: input.teamIds });
  assignTeams(req, now, user.id, admin, input.teamIds);
  return adminItem(admin, user, now);
});

patch('/admins/:id', ({ req, user, params, body, now }) => {
  requirePermission(user, 'users.update');
  const input = parse(updateAdminSchema, body);
  const admin = findUser(params.id!);
  if (!admin || admin.role !== 'ADMIN') throw new DomainError('USER_NOT_FOUND');
  assertUnique(input.email, input.employeeCode, admin.id);
  const fields = (['name', 'email', 'employeeCode', 'jobTitle'] as const).filter(
    (key) => input[key] !== undefined && input[key] !== admin[key],
  );
  for (const key of fields) admin[key] = input[key]!;
  if (fields.length) addAudit(req, now, user.id, 'USER_UPDATED', 'USER', admin.id, { fields });
  if (input.teamIds) assignTeams(req, now, user.id, admin, input.teamIds);
  return adminItem(admin, user, now);
});

function loadManagedAccount(user: SeedUser, id: string) {
  const target = findUser(id);
  if (!target || target.role === 'SUPER_ADMIN') throw new DomainError('USER_NOT_FOUND');
  if (target.id === user.id) throw new DomainError('CANNOT_CHANGE_OWN_ACCOUNT');
  return target;
}

post('/users/:id/deactivate', ({ req, user, params, now }) => {
  requirePermission(user, 'users.deactivate');
  const target = loadManagedAccount(user, params.id!);
  if (target.isActive) {
    target.isActive = false;
    for (const [token, session] of db().sessions) if (session.userId === target.id) db().sessions.delete(token);
    addAudit(req, now, user.id, 'USER_DEACTIVATED', 'USER', target.id);
  }
  return employeeDetail(target, user, now);
});

post('/users/:id/reactivate', ({ req, user, params, now }) => {
  requirePermission(user, 'users.deactivate');
  const target = loadManagedAccount(user, params.id!);
  if (!target.isActive) {
    target.isActive = true;
    addAudit(req, now, user.id, 'USER_REACTIVATED', 'USER', target.id);
  }
  return employeeDetail(target, user, now);
});

post('/users/:id/password-reset', ({ req, user, params, now }) => {
  requirePermission(user, 'users.update');
  const target = loadManagedAccount(user, params.id!);
  const { token, expiresAt } = issueResetToken(target.id, now);
  addAudit(req, now, user.id, 'PASSWORD_RESET_ISSUED', 'USER', target.id);
  return { resetUrl: `/reset-password?token=${token}`, expiresAt: expiresAt.toISOString() } satisfies PasswordResetIssued;
});
