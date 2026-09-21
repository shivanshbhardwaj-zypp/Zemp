import { Body, Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
  type ListReviewsQuery,
  type ResubmitSelfReportInput,
  type ReviewDecisionInput,
  type ReviewerOption,
  type SelfReportInputDto,
  type TaskDetail,
  type TaskSummary,
} from '@zemp/shared';
import { ClientInfo, CurrentUser, Now, RequirePermissions } from '../../common/auth.js';
import { Paged, paginate, zodPipe } from '../../common/http.js';
import { StoreService, type SeedTask, type SeedUser } from '../../data/store.service.js';
import type { ClientContext } from '../auth/auth.service.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { TasksService } from '../tasks/tasks.service.js';

/**
 * Work employees log themselves, and the review that decides whether it counts. Submissions stay
 * out of every workload figure until approved — that rule lives in `@zemp/shared`, not here.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly store: StoreService,
    private readonly tasks: TasksService,
  ) {}

  private reviewerCandidate(user: SeedUser) {
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      ownedTeamIds: this.store.managedTeamIds(user),
    };
  }

  private authorScope(user: SeedUser) {
    return { id: user.id, role: user.role, teamId: this.store.currentTeam(user.id)?.id ?? null };
  }

  /** Who this person may send work to: a manager of their team, or a Super Admin. */
  reviewers(user: SeedUser): ReviewerOption[] {
    const author = this.authorScope(user);
    return this.store.users
      .filter((candidate) => canReviewFor(this.reviewerCandidate(candidate), author))
      .map((candidate): ReviewerOption => {
        const team = this.store.currentTeam(candidate.id);
        return {
          ...this.store.userRef(candidate),
          team: team ? this.store.teamRef(team) : null,
          relationship: candidate.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'TEAM_ADMIN',
        };
      })
      .sort((a, b) => Number(a.relationship === 'SUPER_ADMIN') - Number(b.relationship === 'SUPER_ADMIN'));
  }

  async submit(user: SeedUser, input: SelfReportInputDto, client: ClientContext, now: Date): Promise<TaskDetail> {
    const actor = this.store.actorFor(user);
    // An unknown reviewer id must not read differently from one out of scope.
    const chosen = this.store.findUser(input.reviewerId);
    if (!chosen) throw new DomainError('REVIEWER_OUT_OF_SCOPE');

    const plan = planSelfReport({
      actor,
      author: this.authorScope(user),
      reviewer: { ...this.reviewerCandidate(chosen), name: chosen.name },
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
      id: this.store.newId(),
      createdAt: now,
      updatedAt: now,
      completionNote: null,
      createdById: user.id,
      updatedById: user.id,
    };
    await this.store.createTask(task);
    await this.tasks.applyPlan(task, actor, { patch: {}, ...plan }, client, now);
    return this.store.taskDetail(task, actor, now);
  }

  /** The viewer's own queue: submissions they were asked to decide (Super Admins see them all). */
  queue(user: SeedUser, query: ListReviewsQuery, now: Date): Paged<TaskSummary> {
    const actor = this.store.actorFor(user);
    const items = this.store.tasks
      .filter((task) => task.reviewStatus === query.status && canReviewTask(actor, task))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const page = paginate(items, query.page, query.pageSize);
    return new Paged(
      page.items.map((task) => this.store.summarizeTask(task, actor, now)),
      page.meta,
    );
  }

  async decide(user: SeedUser, id: string, input: ReviewDecisionInput, client: ClientContext, now: Date): Promise<TaskDetail> {
    const actor = this.store.actorFor(user);
    const task = this.store.loadTask(actor, id);
    const plan = planReviewDecision({ actor, task, decision: input.decision, note: input.note, now });
    await this.tasks.applyPlan(task, actor, plan, client, now);
    return this.store.taskDetail(task, actor, now);
  }

  async resubmit(user: SeedUser, id: string, input: ResubmitSelfReportInput, client: ClientContext, now: Date): Promise<TaskDetail> {
    const actor = this.store.actorFor(user);
    const task = this.store.loadTask(actor, id);
    const plan = planResubmit({
      actor,
      task,
      now,
      input: {
        title: input.title,
        description: input.description,
        evidenceUrl: input.evidenceUrl,
        completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
      },
    });
    await this.tasks.applyPlan(task, actor, plan, client, now);
    return this.store.taskDetail(task, actor, now);
  }
}

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('reviews/reviewers')
  @RequirePermissions('tasks.selfReport')
  @ApiOperation({ summary: 'Who you may ask to review your work' })
  reviewers(@CurrentUser() user: SeedUser): ReviewerOption[] {
    return this.reviews.reviewers(user);
  }

  @Post('tasks/self-report')
  @RequirePermissions('tasks.selfReport')
  @ApiOperation({ summary: 'Log work you completed yourself, for review' })
  submit(
    @CurrentUser() user: SeedUser,
    @Body(zodPipe(selfReportSchema)) input: SelfReportInputDto,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<TaskDetail> {
    return this.reviews.submit(user, input, client, now);
  }

  @Post('tasks/:id/resubmit')
  @RequirePermissions('tasks.selfReport')
  @ApiOperation({ summary: 'Revise returned work and send it back' })
  resubmit(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(resubmitSelfReportSchema)) input: ResubmitSelfReportInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<TaskDetail> {
    return this.reviews.resubmit(user, id, input, client, now);
  }

  @Get('reviews')
  @RequirePermissions('tasks.review')
  @ApiOperation({ summary: 'Submissions awaiting your decision' })
  queue(
    @CurrentUser() user: SeedUser,
    @Query(zodPipe(listReviewsQuerySchema)) query: ListReviewsQuery,
    @Now() now: Date,
  ): Paged<TaskSummary> {
    return this.reviews.queue(user, query, now);
  }

  @Post('reviews/:id/decision')
  @RequirePermissions('tasks.review')
  @ApiOperation({ summary: 'Approve a submission, or ask for changes' })
  decide(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(reviewDecisionSchema)) input: ReviewDecisionInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<TaskDetail> {
    return this.reviews.decide(user, id, input, client, now);
  }
}

@Module({
  imports: [TasksModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
