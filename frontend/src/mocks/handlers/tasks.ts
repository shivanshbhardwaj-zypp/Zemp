/** PHASE A MOCK — tasks, comments and activity. Rules come from @zemp/shared planners. */
import {
  DomainError,
  TASK_PRIORITIES,
  TASK_STATUSES,
  addDays,
  assignableUsersQuerySchema,
  canAssignTo,
  canViewTask,
  changeStatusSchema,
  createCommentSchema,
  createTaskSchema,
  deadlineState,
  listTasksQuerySchema,
  planComment,
  planCreateTask,
  planProgressUpdate,
  planReassign,
  planStatusChange,
  planTaskUpdate,
  reassignTaskSchema,
  startOfDay,
  updateProgressSchema,
  updateTaskSchema,
  type AssignableUser,
  type NamedActor,
  type TaskCommentEntry,
  type TaskPlan,
} from '@zemp/shared';
import type { SeedTask, SeedUser } from '@zemp/shared/seed';
import {
  activityEntry,
  actorFor,
  addAudit,
  candidateFor,
  currentTeam,
  db,
  findTask,
  findUser,
  newId,
  ownedTeams,
  summarizeTask,
  taskDetail,
  teamRef,
  userRef,
  visibleTasks,
  zone,
} from '../db';
import { Paged, get, paginate, parse, patch, post, requirePermission } from '../http';

function loadTask(actor: NamedActor, id: string) {
  const task = findTask(id);
  if (!task || !canViewTask(actor, task)) throw new DomainError('TASK_NOT_FOUND');
  return task;
}

function applyPlan(req: Request, now: Date, actor: NamedActor, task: SeedTask, plan: TaskPlan) {
  const store = db();
  const changes = { ...plan.patch };
  delete changes.resetDeadlineReminders; // planner flag, not a stored task field
  Object.assign(task, changes);
  if (plan.activities.length) {
    task.updatedAt = now;
    task.updatedById = actor.id;
  }
  for (const activity of plan.activities) {
    store.activities.push({ id: newId(), taskId: task.id, actorId: actor.id, ...activity, createdAt: now });
  }
  for (const notification of plan.notifications) {
    store.notifications.unshift({ id: newId(), ...notification, taskId: task.id, readAt: null, createdAt: now });
  }
  for (const entry of plan.audits) addAudit(req, now, actor.id, entry.action, 'TASK', task.id, entry.metadata);
}

const candidateById = (id: string) => {
  const user = findUser(id);
  // An unknown id looks exactly like an out-of-scope one.
  if (!user) throw new DomainError('ASSIGNEE_OUT_OF_SCOPE');
  return candidateFor(user);
};

get('/tasks', ({ user, query, now }) => {
  const q = parse(listTasksQuerySchema, query);
  const actor = actorFor(user);
  const tz = zone();
  const bounds = (from?: string, to?: string) => ({
    from: from ? startOfDay(from, tz) : null,
    to: to ? startOfDay(addDays(to, 1), tz) : null,
  });
  const due = bounds(q.dueFrom, q.dueTo);
  const assigned = bounds(q.assignedFrom, q.assignedTo);
  const search = q.search?.toLowerCase();
  const assigneeId = q.assigneeId === 'me' ? user.id : q.assigneeId;
  const adminTeamIds = q.adminId ? db().teams.filter((t) => t.ownerId === q.adminId).map((t) => t.id) : null;

  const items = visibleTasks(actor).filter(
    (t) =>
      (!search || t.title.toLowerCase().includes(search)) &&
      (!q.status || q.status.includes(t.status)) &&
      (!q.priority || q.priority.includes(t.priority)) &&
      (!q.teamId || t.teamId === q.teamId) &&
      (!assigneeId || t.assigneeId === assigneeId) &&
      (!adminTeamIds || (t.teamId !== null && adminTeamIds.includes(t.teamId))) &&
      (!due.from || t.dueAt >= due.from) &&
      (!due.to || t.dueAt < due.to) &&
      (!assigned.from || t.createdAt >= assigned.from) &&
      (!assigned.to || t.createdAt < assigned.to) &&
      (!q.deadline || deadlineState(t, now, tz) === q.deadline),
  );

  const sortKey = (t: SeedTask): number | string => {
    switch (q.sort) {
      case 'priority':
        return TASK_PRIORITIES.indexOf(t.priority);
      case 'status':
        return TASK_STATUSES.indexOf(t.status);
      case 'title':
        return t.title.toLowerCase();
      case 'progress':
        return t.progress;
      default:
        return t[q.sort].getTime();
    }
  };
  const direction = q.order === 'asc' ? 1 : -1;
  items.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    return (ka < kb ? -1 : ka > kb ? 1 : 0) * direction || a.id.localeCompare(b.id);
  });

  const page = paginate(items, q.page, q.pageSize);
  return new Paged(page.items.map((t) => summarizeTask(t, actor, now)), page.meta);
});

get('/tasks/assignable-users', ({ user, query }) => {
  const q = parse(assignableUsersQuerySchema, query);
  const actor = actorFor(user);
  const search = q.search?.toLowerCase();
  return db()
    .users.filter((u) => u.isActive && (!search || u.name.toLowerCase().includes(search)))
    .map((u) => [u, candidateFor(u)] as const)
    .filter(([, c]) => canAssignTo(actor, c))
    .filter(([, c]) => !q.teamId || c.teamId === q.teamId || c.ownedTeamIds.includes(q.teamId))
    .map(([u]): AssignableUser => {
      const team = currentTeam(u.id);
      return { ...userRef(u), team: team ? teamRef(team) : null, ownedTeams: ownedTeams(u.id).map(teamRef) };
    })
    .sort((a, b) => Number(a.role === 'EMPLOYEE') - Number(b.role === 'EMPLOYEE') || a.name.localeCompare(b.name));
});

post('/tasks', ({ req, user, body, now }) => {
  requirePermission(user, 'tasks.create');
  const input = parse(createTaskSchema, body);
  const actor = actorFor(user);
  const plan = planCreateTask({
    actor,
    assignee: candidateById(input.assigneeId),
    now,
    input: {
      title: input.title,
      description: input.description || null,
      priority: input.priority,
      startAt: input.startAt ? new Date(input.startAt) : null,
      dueAt: new Date(input.dueAt),
      teamId: input.teamId ?? null,
    },
  });
  const task: SeedTask = {
    ...plan.task,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    completionNote: null,
    createdById: user.id,
    updatedById: user.id,
  };
  db().tasks.push(task);
  applyPlan(req, now, actor, task, { patch: {}, ...plan });
  return taskDetail(task, actor, now);
});

get('/tasks/:id', ({ user, params, now }) => {
  const actor = actorFor(user);
  return taskDetail(loadTask(actor, params.id!), actor, now);
});

patch('/tasks/:id', ({ req, user, params, body, now }) => {
  requirePermission(user, 'tasks.update');
  const input = parse(updateTaskSchema, body);
  const actor = actorFor(user);
  const task = loadTask(actor, params.id!);
  const plan = planTaskUpdate({
    actor,
    task,
    now,
    input: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      startAt: input.startAt === undefined ? undefined : input.startAt ? new Date(input.startAt) : null,
      dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
    },
  });
  applyPlan(req, now, actor, task, plan);
  return taskDetail(task, actor, now);
});

patch('/tasks/:id/progress', ({ req, user, params, body, now }) => {
  const input = parse(updateProgressSchema, body);
  const actor = actorFor(user);
  const task = loadTask(actor, params.id!);
  applyPlan(req, now, actor, task, planProgressUpdate({ actor, task, progress: input.progress, now }));
  return taskDetail(task, actor, now);
});

patch('/tasks/:id/status', ({ req, user, params, body, now }) => {
  const input = parse(changeStatusSchema, body);
  const actor = actorFor(user);
  const task = loadTask(actor, params.id!);
  applyPlan(req, now, actor, task, planStatusChange({ actor, task, to: input.status, note: input.note, now }));
  return taskDetail(task, actor, now);
});

patch('/tasks/:id/assignee', ({ req, user, params, body, now }) => {
  requirePermission(user, 'tasks.reassign');
  const input = parse(reassignTaskSchema, body);
  const actor = actorFor(user);
  const task = loadTask(actor, params.id!);
  const plan = planReassign({ actor, task, assignee: candidateById(input.assigneeId), teamId: input.teamId });
  applyPlan(req, now, actor, task, plan);
  return taskDetail(task, actor, now);
});

get('/tasks/:id/activity', ({ user, params }) => {
  const task = loadTask(actorFor(user), params.id!);
  return db()
    .activities.filter((a) => a.taskId === task.id)
    .reverse()
    .map(activityEntry);
});

const commentEntry = (comment: { id: string; body: string; authorId: string; createdAt: Date }, author: SeedUser): TaskCommentEntry => ({
  id: comment.id,
  body: comment.body,
  author: userRef(author),
  createdAt: comment.createdAt.toISOString(),
});

get('/tasks/:id/comments', ({ user, params }) => {
  const task = loadTask(actorFor(user), params.id!);
  return db()
    .comments.filter((c) => c.taskId === task.id)
    .map((c) => commentEntry(c, findUser(c.authorId)!));
});

post('/tasks/:id/comments', ({ req, user, params, body, now }) => {
  const input = parse(createCommentSchema, body);
  const actor = actorFor(user);
  const task = loadTask(actor, params.id!);
  const plan = planComment({ actor, task });
  const comment = { id: newId(), taskId: task.id, authorId: user.id, body: input.body, createdAt: now };
  db().comments.push(comment);
  applyPlan(req, now, actor, task, plan);
  return commentEntry(comment, user);
});
