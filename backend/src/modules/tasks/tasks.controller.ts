import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  assignableUsersQuerySchema,
  bulkCreateTaskSchema,
  changeStatusSchema,
  createCommentSchema,
  createTaskSchema,
  listTasksQuerySchema,
  reassignTaskSchema,
  updateProgressSchema,
  updateTaskSchema,
  type AssignableUser,
  type AssignableUsersQuery,
  type BulkCreateTaskInput,
  type ChangeStatusInput,
  type CreateCommentInput,
  type CreateTaskInput,
  type IncentiveOverview,
  type ListTasksQuery,
  type ReassignTaskInput,
  type TaskActivityEntry,
  type TaskCommentEntry,
  type TaskDetail,
  type TaskSummary,
  type UpdateTaskInput,
} from '@zemp/shared';
import { ClientInfo, CurrentUser, Now, RequirePermissions } from '../../common/auth.js';
import { Paged, zodPipe } from '../../common/http.js';
import type { SeedUser } from '../../data/store.service.js';
import type { ClientContext } from '../auth/auth.service.js';
import { TasksService } from './tasks.service.js';

/**
 * Thin by design: validate, delegate, return. Permissions are declared per route; the scope rules
 * that narrow them (whose task, which team) live in the domain layer and run inside the service.
 */
@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermissions('tasks.read')
  @ApiOperation({ summary: 'List tasks in scope, filtered, sorted and paginated' })
  list(
    @CurrentUser() user: SeedUser,
    @Query(zodPipe(listTasksQuerySchema)) query: ListTasksQuery,
    @Now() now: Date,
  ): Paged<TaskSummary> {
    return this.tasks.list(user, query, now);
  }

  @Get('assignable-users')
  @RequirePermissions('tasks.assign')
  @ApiOperation({ summary: 'People this user may assign work to' })
  assignable(
    @CurrentUser() user: SeedUser,
    @Query(zodPipe(assignableUsersQuerySchema)) query: AssignableUsersQuery,
  ): AssignableUser[] {
    return this.tasks.assignableUsers(user, query);
  }

  @Post()
  @RequirePermissions('tasks.create')
  @ApiOperation({ summary: 'Assign a new task' })
  create(
    @CurrentUser() user: SeedUser,
    @Body(zodPipe(createTaskSchema)) input: CreateTaskInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<TaskDetail> {
    return this.tasks.create(user, input, client, now);
  }

  @Post('bulk')
  @RequirePermissions('tasks.create')
  @ApiOperation({ summary: 'Assign the same task to several people at once' })
  createBulk(
    @CurrentUser() user: SeedUser,
    @Body(zodPipe(bulkCreateTaskSchema)) input: BulkCreateTaskInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<TaskDetail[]> {
    return this.tasks.createBulk(user, input, client, now);
  }

  @Get(':id')
  @RequirePermissions('tasks.read')
  @ApiOperation({ summary: 'One task, with the actions this viewer may take on it' })
  get(@CurrentUser() user: SeedUser, @Param('id', ParseUUIDPipe) id: string, @Now() now: Date): TaskDetail {
    return this.tasks.get(user, id, now);
  }

  @Patch(':id')
  @RequirePermissions('tasks.update')
  @ApiOperation({ summary: 'Edit a task within scope' })
  update(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(updateTaskSchema)) input: UpdateTaskInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<TaskDetail> {
    return this.tasks.update(user, id, input, client, now);
  }

  @Patch(':id/progress')
  @RequirePermissions('tasks.update')
  @ApiOperation({ summary: 'Update progress; 100% completes the task' })
  progress(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(updateProgressSchema)) input: { progress: number },
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<TaskDetail> {
    return this.tasks.updateProgress(user, id, input.progress, client, now);
  }

  @Patch(':id/status')
  @RequirePermissions('tasks.update')
  @ApiOperation({ summary: 'Move a task through its lifecycle' })
  status(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(changeStatusSchema)) input: ChangeStatusInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<TaskDetail> {
    return this.tasks.changeStatus(user, id, input, client, now);
  }

  @Patch(':id/assignee')
  @RequirePermissions('tasks.reassign')
  @ApiOperation({ summary: 'Reassign a task within scope' })
  reassign(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(reassignTaskSchema)) input: ReassignTaskInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<TaskDetail> {
    return this.tasks.reassign(user, id, input, client, now);
  }

  @Get(':id/activity')
  @RequirePermissions('tasks.read')
  @ApiOperation({ summary: "A task's history, newest first" })
  activity(@CurrentUser() user: SeedUser, @Param('id', ParseUUIDPipe) id: string): TaskActivityEntry[] {
    return this.tasks.activity(user, id);
  }

  @Get(':id/comments')
  @RequirePermissions('tasks.read')
  @ApiOperation({ summary: 'Comments on a task' })
  comments(@CurrentUser() user: SeedUser, @Param('id', ParseUUIDPipe) id: string): TaskCommentEntry[] {
    return this.tasks.comments(user, id);
  }

  @Post(':id/comments')
  @RequirePermissions('tasks.read')
  @ApiOperation({ summary: 'Comment on a task' })
  addComment(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(createCommentSchema)) input: CreateCommentInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<TaskCommentEntry> {
    return this.tasks.addComment(user, id, input, client, now);
  }
}

@ApiTags('tasks')
@Controller('incentives')
export class IncentivesController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Your own incentivized tasks — what you have earned and what is still open' })
  mine(@CurrentUser() user: SeedUser): IncentiveOverview {
    return this.tasks.incentives(user);
  }
}
