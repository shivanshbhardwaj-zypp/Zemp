/** PHASE A MOCK — employee-logged work and its review queue. Rules come from @zemp/shared planners. */
import {
  DomainError,
  canReviewFor,
  canReviewTask,
  listReviewsQuerySchema,
  planResubmit,
  planReviewDecision,
  planSelfReport,
  resubmitSelfReportSchema,
  reviewDecisionSchema,
  selfReportSchema,
  type ReviewerOption,
  type TaskSummary,
} from '@zemp/shared';
import type { SeedTask, SeedUser } from '@zemp/shared/seed';
import {
  actorFor,
  currentTeam,
  db,
  findUser,
  newId,
  ownedTeams,
  summarizeTask,
  taskDetail,
  teamRef,
  userRef,
} from '../db';
import { Paged, get, paginate, parse, post, requirePermission } from '../http';
import { applyPlan, loadTask } from './tasks';

const reviewerCandidate = (u: SeedUser) => ({
  id: u.id,
  name: u.name,
  role: u.role,
  isActive: u.isActive,
  ownedTeamIds: ownedTeams(u.id).map((t) => t.id),
});

const authorScope = (u: SeedUser) => ({ id: u.id, role: u.role, teamId: currentTeam(u.id)?.id ?? null });

/** Who this employee may send work to: the admin who owns their team, or a Super Admin. */
get('/reviews/reviewers', ({ user }) => {
  requirePermission(user, 'tasks.selfReport');
  const author = authorScope(user);
  return db()
    .users.filter((u) => canReviewFor(reviewerCandidate(u), author))
    .map((u): ReviewerOption => {
      const team = currentTeam(u.id);
      return {
        ...userRef(u),
        team: team ? teamRef(team) : null,
        relationship: u.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'TEAM_ADMIN',
      };
    })
    .sort((a, b) => Number(a.relationship === 'SUPER_ADMIN') - Number(b.relationship === 'SUPER_ADMIN'));
});

post('/tasks/self-report', ({ req, user, body, now }) => {
  requirePermission(user, 'tasks.selfReport');
  const input = parse(selfReportSchema, body);
  const actor = actorFor(user);
  // An unknown reviewer id must not read differently from one out of scope.
  const chosen = findUser(input.reviewerId);
  if (!chosen) throw new DomainError('REVIEWER_OUT_OF_SCOPE');
  const plan = planSelfReport({
    actor,
    author: authorScope(user),
    reviewer: { ...reviewerCandidate(chosen), name: chosen.name },
    now,
    input: {
      title: input.title,
      description: input.description,
      evidenceUrl: input.evidenceUrl ?? null,
      completedAt: new Date(input.completedAt),
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

/** The viewer's own queue: submissions they were asked to decide (Super Admins see them all). */
get('/reviews', ({ user, query, now }) => {
  requirePermission(user, 'tasks.review');
  const q = parse(listReviewsQuerySchema, query);
  const actor = actorFor(user);
  const items = db()
    .tasks.filter((t) => t.reviewStatus === q.status && canReviewTask(actor, t))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const page = paginate(items, q.page, q.pageSize);
  return new Paged<TaskSummary>(
    page.items.map((t) => summarizeTask(t, actor, now)),
    page.meta,
  );
});

post('/reviews/:id/decision', ({ req, user, params, body, now }) => {
  requirePermission(user, 'tasks.review');
  const input = parse(reviewDecisionSchema, body);
  const actor = actorFor(user);
  const task = loadTask(actor, params.id!);
  applyPlan(req, now, actor, task, planReviewDecision({ actor, task, decision: input.decision, note: input.note, now }));
  return taskDetail(task, actor, now);
});

post('/tasks/:id/resubmit', ({ req, user, params, body, now }) => {
  requirePermission(user, 'tasks.selfReport');
  const input = parse(resubmitSelfReportSchema, body);
  const actor = actorFor(user);
  const task = loadTask(actor, params.id!);
  applyPlan(
    req,
    now,
    actor,
    task,
    planResubmit({
      actor,
      task,
      now,
      input: {
        title: input.title,
        description: input.description,
        evidenceUrl: input.evidenceUrl,
        completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
      },
    }),
  );
  return taskDetail(task, actor, now);
});
