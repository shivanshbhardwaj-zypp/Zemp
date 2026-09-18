import { Injectable } from '@nestjs/common';
import {
  DomainError,
  TASK_PRIORITIES,
  TASK_STATUSES,
  addDays,
  canAssignTo,
  deadlineState,
  planComment,
  planCreateTask,
  planProgressUpdate,
  planReassign,
  planStatusChange,
  planTaskUpdate,
  startOfDay,
  summarizeIncentives,
  type AssignableUser,
  type AssignableUsersQuery,
  type ChangeStatusInput,
  type CreateCommentInput,
  type CreateTaskInput,
  type IncentiveOverview,
  type ListTasksQuery,
  type NamedActor,
  type ReassignTaskInput,
  type TaskActivityEntry,
  type TaskCommentEntry,
  type TaskDetail,
  type TaskPlan,
  type TaskSummary,
  type UpdateTaskInput,
} from '@zemp/shared';
import { Paged, paginate } from '../../common/http.js';
import { StoreService, type SeedTask, type SeedUser } from '../../data/store.service.js';
import type { ClientContext } from '../auth/auth.service.js';

/**
 * Tasks. Every rule — who may see a task, which transitions are legal, what an update implies for
 * history and notifications — comes from the planners in `@zemp/shared`, so the API and the UI can
 * never drift apart. This service loads rows, runs the planner, and persists its plan.
 */
@Injectable()
export class TasksService {
  constructor(private readonly store: StoreService) {}

  /**
   * Applies a planner's output: the patch, the activity trail, the notifications and the audit
   * entries land together. Phase C wraps this in a database transaction.
   */
  applyPlan(task: SeedTask, actor: NamedActor, plan: TaskPlan, client: ClientContext, now: Date): void {
    const changes = { ...plan.patch };
    delete changes.resetDeadlineReminders; // A planner flag, not a stored column.
    Object.assign(task, changes);
    if (plan.activities.length) {
      task.updatedAt = now;
      task.updatedById = actor.id;
    }
    for (const activity of plan.activities) this.store.addActivity(task.id, actor.id, activity, now);
    for (const notification of plan.notifications) this.store.addNotification(notification, task.id, now);
    for (const entry of plan.audits) {
      this.store.addAudit({
        actorId: actor.id,
        action: entry.action,
        resourceType: 'TASK',
        resourceId: task.id,
        at: now,
        metadata: entry.metadata,
        ...client,
      });
    }
  }

  /** An unknown assignee id must be indistinguishable from one outside the actor's scope. */
  private candidateById(id: string) {
    const user = this.store.findUser(id);
    if (!user) throw new DomainError('ASSIGNEE_OUT_OF_SCOPE');
    return this.store.candidateFor(user);
  }

  list(user: SeedUser, query: ListTasksQuery, now: Date): Paged<TaskSummary> {
    const actor = this.store.actorFor(user);
    const tz = this.store.timeZone;
    const bounds = (from?: string, to?: string) => ({
      from: from ? startOfDay(from, tz) : null,
      to: to ? startOfDay(addDays(to, 1), tz) : null,
    });
    const due = bounds(query.dueFrom, query.dueTo);
    const assigned = bounds(query.assignedFrom, query.assignedTo);
    const search = query.search?.toLowerCase();
    const assigneeId = query.assigneeId === 'me' ? user.id : query.assigneeId;
    const adminTeamIds = query.adminId
      ? this.store.teams.filter((t) => t.ownerId === query.adminId).map((t) => t.id)
      : null;

    const items = this.store.visibleTasks(actor).filter(
      (t) =>
        (!search || t.title.toLowerCase().includes(search)) &&
        (!query.status || query.status.includes(t.status)) &&
        (!query.priority || query.priority.includes(t.priority)) &&
        (!query.teamId || t.teamId === query.teamId) &&
        (!assigneeId || t.assigneeId === assigneeId) &&
        (!adminTeamIds || (t.teamId !== null && adminTeamIds.includes(t.teamId))) &&
        (!due.from || t.dueAt >= due.from) &&
        (!due.to || t.dueAt < due.to) &&
        (!assigned.from || t.createdAt >= assigned.from) &&
        (!assigned.to || t.createdAt < assigned.to) &&
        (!query.deadline || deadlineState(t, now, tz) === query.deadline),
    );

    const sortKey = (t: SeedTask): number | string => {
      switch (query.sort) {
        case 'priority':
          return TASK_PRIORITIES.indexOf(t.priority);
        case 'status':
          return TASK_STATUSES.indexOf(t.status);
        case 'title':
          return t.title.toLowerCase();
        case 'progress':
          return t.progress;
        default:
          return t[query.sort].getTime();
      }
    };
    const direction = query.order === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * direction || a.id.localeCompare(b.id);
    });

    const page = paginate(items, query.page, query.pageSize);
    return new Paged(
      page.items.map((t) => this.store.summarizeTask(t, actor, now)),
      page.meta,
    );
  }

  /** Who this user may assign work to — the same scope rule the assignment itself re-checks. */
  assignableUsers(user: SeedUser, query: AssignableUsersQuery): AssignableUser[] {
    const actor = this.store.actorFor(user);
    const search = query.search?.toLowerCase();
    return this.store.users
      .filter((u) => u.isActive && (!search || u.name.toLowerCase().includes(search)))
      .map((u) => [u, this.store.candidateFor(u)] as const)
      .filter(([, candidate]) => canAssignTo(actor, candidate))
      .filter(
        ([, candidate]) =>
          !query.teamId || candidate.teamId === query.teamId || candidate.ownedTeamIds.includes(query.teamId),
      )
      .map(([u]): AssignableUser => {
        const team = this.store.currentTeam(u.id);
        return {
          ...this.store.userRef(u),
          team: team ? this.store.teamRef(team) : null,
          ownedTeams: this.store.ownedTeams(u.id).map((t) => this.store.teamRef(t)),
        };
      })
      .sort((a, b) => Number(a.role === 'EMPLOYEE') - Number(b.role === 'EMPLOYEE') || a.name.localeCompare(b.name));
  }

  create(user: SeedUser, input: CreateTaskInput, client: ClientContext, now: Date): TaskDetail {
    const actor = this.store.actorFor(user);
    const plan = planCreateTask({
      actor,
      assignee: this.candidateById(input.assigneeId),
      now,
      input: {
        title: input.title,
        description: input.description || null,
        priority: input.priority,
        startAt: input.startAt ? new Date(input.startAt) : null,
        dueAt: new Date(input.dueAt),
        teamId: input.teamId ?? null,
        incentiveAmount: input.incentiveAmount ?? null,
      },
    });
    const task: SeedTask = {
      ...plan.task,
      id: this.store.newId(),
      createdAt: now,
      updatedAt: now,
      completionNote: null,
      createdById: user.id,
      updatedById: user.id,
    };
    this.store.tasks.push(task);
    this.applyPlan(task, actor, { patch: {}, ...plan }, client, now);
    return this.store.taskDetail(task, actor, now);
  }

  get(user: SeedUser, id: string, now: Date): TaskDetail {
    const actor = this.store.actorFor(user);
    return this.store.taskDetail(this.store.loadTask(actor, id), actor, now);
  }

  update(user: SeedUser, id: string, input: UpdateTaskInput, client: ClientContext, now: Date): TaskDetail {
    const actor = this.store.actorFor(user);
    const task = this.store.loadTask(actor, id);
    const plan = planTaskUpdate({
      actor,
      task,
      assigneeRole: this.store.assigneeRoleOf(task),
      now,
      input: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        startAt: input.startAt === undefined ? undefined : input.startAt ? new Date(input.startAt) : null,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        incentiveAmount: input.incentiveAmount,
      },
    });
    this.applyPlan(task, actor, plan, client, now);
    return this.store.taskDetail(task, actor, now);
  }

  /** The viewer's own incentivized tasks — never anyone else's; there's no team or ID to spoof. */
  incentives(user: SeedUser): IncentiveOverview {
    return summarizeIncentives(this.store.tasks.filter((t) => t.assigneeId === user.id));
  }

  updateProgress(user: SeedUser, id: string, progress: number, client: ClientContext, now: Date): TaskDetail {
    const actor = this.store.actorFor(user);
    const task = this.store.loadTask(actor, id);
    const plan = planProgressUpdate({ actor, task, progress, assigneeRole: this.store.assigneeRoleOf(task), now });
    this.applyPlan(task, actor, plan, client, now);
    return this.store.taskDetail(task, actor, now);
  }

  changeStatus(user: SeedUser, id: string, input: ChangeStatusInput, client: ClientContext, now: Date): TaskDetail {
    const actor = this.store.actorFor(user);
    const task = this.store.loadTask(actor, id);
    const plan = planStatusChange({
      actor,
      task,
      to: input.status,
      note: input.note,
      assigneeRole: this.store.assigneeRoleOf(task),
      now,
    });
    this.applyPlan(task, actor, plan, client, now);
    return this.store.taskDetail(task, actor, now);
  }

  reassign(user: SeedUser, id: string, input: ReassignTaskInput, client: ClientContext, now: Date): TaskDetail {
    const actor = this.store.actorFor(user);
    const task = this.store.loadTask(actor, id);
    const plan = planReassign({
      actor,
      task,
      assignee: this.candidateById(input.assigneeId),
      teamId: input.teamId,
      assigneeRole: this.store.assigneeRoleOf(task),
    });
    this.applyPlan(task, actor, plan, client, now);
    return this.store.taskDetail(task, actor, now);
  }

  activity(user: SeedUser, id: string): TaskActivityEntry[] {
    const actor = this.store.actorFor(user);
    const task = this.store.loadTask(actor, id);
    return this.store.activities
      .filter((event) => event.taskId === task.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((event) => this.store.activityEntry(event));
  }

  comments(user: SeedUser, id: string): TaskCommentEntry[] {
    const actor = this.store.actorFor(user);
    const task = this.store.loadTask(actor, id);
    return this.store.comments
      .filter((comment) => comment.taskId === task.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((comment) => ({
        id: comment.id,
        body: comment.body,
        author: this.store.userRef(this.store.findUser(comment.authorId)!),
        createdAt: comment.createdAt.toISOString(),
      }));
  }

  addComment(user: SeedUser, id: string, input: CreateCommentInput, client: ClientContext, now: Date): TaskCommentEntry {
    const actor = this.store.actorFor(user);
    const task = this.store.loadTask(actor, id);
    const plan = planComment({ actor, task });
    const comment = { id: this.store.newId(), taskId: task.id, authorId: user.id, body: input.body, createdAt: now };
    this.store.comments.push(comment);
    this.applyPlan(task, actor, plan, client, now);
    return {
      id: comment.id,
      body: comment.body,
      author: this.store.userRef(user),
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
