import { Body, Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DomainError,
  PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLES,
  addDays,
  auditSummary,
  canViewTask,
  listAuditLogsQuerySchema,
  listNotificationsQuerySchema,
  startOfDay,
  updateOrganizationSchema,
  type AuditLogEntry,
  type ListAuditLogsQuery,
  type ListNotificationsQuery,
  type NotificationItem,
  type OrganizationSettings,
  type RoleMatrix,
  type UpdateOrganizationInput,
} from '@zemp/shared';
import { ClientInfo, CurrentUser, Now, RequirePermissions } from '../../common/auth.js';
import { Paged, paginate, zodPipe } from '../../common/http.js';
import { StoreService, type SeedUser } from '../../data/store.service.js';
import type { ClientContext } from '../auth/auth.service.js';

/** Notifications, the audit log and organization settings — small surfaces, one module. */
@Injectable()
export class InboxService {
  constructor(private readonly store: StoreService) {}

  /**
   * The audit log is the source of truth for "when did this last change" — the seed writes a
   * SETTINGS_UPDATED entry at org creation, and every edit adds another, so there is no separate
   * timestamp field to keep in sync (and no risk of it defaulting to "just now" at server boot).
   */
  private organizationUpdatedAt(): Date {
    return (
      this.store.auditLogs.findLast((e) => e.action === 'SETTINGS_UPDATED' && e.resourceType === 'ORGANIZATION')
        ?.createdAt ?? new Date()
    );
  }

  /** A user only ever sees their own notifications — there is no cross-user read path. */
  notifications(user: SeedUser, query: ListNotificationsQuery): Paged<NotificationItem> {
    const actor = this.store.actorFor(user);
    const items = this.store.notifications.filter((n) => n.userId === user.id && (!query.unread || !n.readAt));
    const page = paginate(items, query.page, query.pageSize);
    return new Paged(
      page.items.map((n): NotificationItem => {
        const task = n.taskId ? this.store.findTask(n.taskId) : undefined;
        return {
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          // The linked task is only exposed if the reader may still see it.
          task: task && canViewTask(actor, task) ? { id: task.id, title: task.title } : null,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
        };
      }),
      page.meta,
    );
  }

  unreadCount(user: SeedUser): { count: number } {
    return { count: this.store.notifications.filter((n) => n.userId === user.id && !n.readAt).length };
  }

  markAllRead(user: SeedUser, now: Date): void {
    for (const n of this.store.notifications) if (n.userId === user.id && !n.readAt) n.readAt = now;
  }

  markRead(user: SeedUser, id: string, now: Date): void {
    const notification = this.store.notifications.find((n) => n.id === id && n.userId === user.id);
    if (!notification) throw new DomainError('NOTIFICATION_NOT_FOUND');
    notification.readAt ??= now;
  }

  auditLogs(query: ListAuditLogsQuery): Paged<AuditLogEntry> {
    const tz = this.store.timeZone;
    const from = query.from ? startOfDay(query.from, tz) : null;
    const to = query.to ? startOfDay(addDays(query.to, 1), tz) : null;
    const entries = this.store.auditLogs
      .filter(
        (e) =>
          (!query.actorId || e.actorId === query.actorId) &&
          (!query.action || e.action === query.action) &&
          (!query.resourceType || e.resourceType === query.resourceType) &&
          (!query.result || e.result === query.result) &&
          (!from || e.createdAt >= from) &&
          (!to || e.createdAt < to),
      )
      .slice()
      .reverse();

    const lookups = {
      user: (id: string) => this.store.findUser(id)?.name,
      team: (id: string) => this.store.findTeam(id)?.name,
      task: (id: string) => this.store.findTask(id)?.title,
    };
    const page = paginate(entries, query.page, query.pageSize);
    return new Paged(
      page.items.map((e): AuditLogEntry => {
        const actor = e.actorId ? this.store.findUser(e.actorId) : undefined;
        return {
          id: e.id,
          action: e.action,
          result: e.result,
          actor: actor ? this.store.userRef(actor) : null,
          resourceType: e.resourceType,
          resourceId: e.resourceId,
          summary: auditSummary(e, lookups),
          metadata: e.metadata,
          ip: e.ip,
          userAgent: e.userAgent,
          createdAt: e.createdAt.toISOString(),
        };
      }),
      page.meta,
    );
  }

  organization(): OrganizationSettings {
    return { ...this.store.organization, updatedAt: this.organizationUpdatedAt().toISOString() };
  }

  updateOrganization(
    user: SeedUser,
    input: UpdateOrganizationInput,
    client: ClientContext,
    now: Date,
  ): OrganizationSettings {
    const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    this.store.updateOrganization(changes);
    this.store.addAudit({
      actorId: user.id,
      action: 'SETTINGS_UPDATED',
      resourceType: 'ORGANIZATION',
      resourceId: null,
      at: now,
      metadata: changes,
      ...client,
    });
    return this.organization();
  }

  /** The permission matrix the settings screen renders — derived, never hand-maintained. */
  roles(): RoleMatrix {
    return {
      roles: SYSTEM_ROLES.map((key) => ({ key, name: ROLE_LABELS[key], permissions: [...ROLE_PERMISSIONS[key]] })),
      permissions: PERMISSIONS.map((key) => ({ key, description: PERMISSION_DESCRIPTIONS[key] })),
    };
  }
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  @ApiOperation({ summary: 'Your notifications' })
  list(
    @CurrentUser() user: SeedUser,
    @Query(zodPipe(listNotificationsQuerySchema)) query: ListNotificationsQuery,
  ): Paged<NotificationItem> {
    return this.inbox.notifications(user, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'How many of your notifications are unread' })
  unread(@CurrentUser() user: SeedUser): { count: number } {
    return this.inbox.unreadCount(user);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all of your notifications read' })
  readAll(@CurrentUser() user: SeedUser, @Now() now: Date): null {
    this.inbox.markAllRead(user, now);
    return null;
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark one notification read' })
  read(@CurrentUser() user: SeedUser, @Param('id', ParseUUIDPipe) id: string, @Now() now: Date): null {
    this.inbox.markRead(user, id, now);
    return null;
  }
}

@ApiTags('audit')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'The append-only audit log, filtered and paginated' })
  list(@Query(zodPipe(listAuditLogsQuerySchema)) query: ListAuditLogsQuery): Paged<AuditLogEntry> {
    return this.inbox.auditLogs(query);
  }
}

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly inbox: InboxService) {}

  @Get('organization')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Organization name and time zone' })
  organization(): OrganizationSettings {
    return this.inbox.organization();
  }

  @Patch('organization')
  @RequirePermissions('settings.update')
  @ApiOperation({ summary: 'Update organization settings' })
  update(
    @CurrentUser() user: SeedUser,
    @Body(zodPipe(updateOrganizationSchema)) input: UpdateOrganizationInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): OrganizationSettings {
    return this.inbox.updateOrganization(user, input, client, now);
  }

  @Get('roles')
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Roles and the permissions each one grants' })
  roles(): RoleMatrix {
    return this.inbox.roles();
  }
}

@Module({
  controllers: [NotificationsController, AuditController, SettingsController],
  providers: [InboxService],
})
export class InboxModule {}
