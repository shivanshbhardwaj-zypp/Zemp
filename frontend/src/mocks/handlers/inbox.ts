/** PHASE A MOCK — notifications, audit log and organization settings. */
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
  type NotificationItem,
  type OrganizationSettings,
  type RoleMatrix,
} from '@zemp/shared';
import { actorFor, addAudit, db, findTask, findTeam, findUser, userRef, zone } from '../db';
import { Paged, get, paginate, parse, patch, post, requirePermission } from '../http';

get('/notifications', ({ user, query }) => {
  const q = parse(listNotificationsQuerySchema, query);
  const actor = actorFor(user);
  const items = db().notifications.filter((n) => n.userId === user.id && (!q.unread || !n.readAt));
  const page = paginate(items, q.page, q.pageSize);
  return new Paged(
    page.items.map((n): NotificationItem => {
      const task = n.taskId ? findTask(n.taskId) : undefined;
      return {
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        task: task && canViewTask(actor, task) ? { id: task.id, title: task.title } : null,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      };
    }),
    page.meta,
  );
});

get('/notifications/unread-count', ({ user }) => ({
  count: db().notifications.filter((n) => n.userId === user.id && !n.readAt).length,
}));

post('/notifications/read-all', ({ user, now }) => {
  for (const n of db().notifications) if (n.userId === user.id && !n.readAt) n.readAt = now;
  return null;
});

post('/notifications/:id/read', ({ user, params, now }) => {
  const notification = db().notifications.find((n) => n.id === params.id && n.userId === user.id);
  if (!notification) throw new DomainError('NOTIFICATION_NOT_FOUND');
  notification.readAt ??= now;
  return null;
});

get('/audit-logs', ({ user, query }) => {
  requirePermission(user, 'audit.read');
  const q = parse(listAuditLogsQuerySchema, query);
  const tz = zone();
  const from = q.from ? startOfDay(q.from, tz) : null;
  const to = q.to ? startOfDay(addDays(q.to, 1), tz) : null;
  const entries = db()
    .auditLogs.filter(
      (e) =>
        (!q.actorId || e.actorId === q.actorId) &&
        (!q.action || e.action === q.action) &&
        (!q.resourceType || e.resourceType === q.resourceType) &&
        (!q.result || e.result === q.result) &&
        (!from || e.createdAt >= from) &&
        (!to || e.createdAt < to),
    )
    .reverse();
  const lookups = {
    user: (id: string) => findUser(id)?.name,
    team: (id: string) => findTeam(id)?.name,
    task: (id: string) => findTask(id)?.title,
  };
  const page = paginate(entries, q.page, q.pageSize);
  return new Paged(
    page.items.map((e): AuditLogEntry => {
      const actor = e.actorId ? findUser(e.actorId) : undefined;
      return {
        id: e.id,
        action: e.action,
        result: e.result,
        actor: actor ? userRef(actor) : null,
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
});

get('/settings/organization', ({ user }) => {
  requirePermission(user, 'settings.read');
  const store = db();
  return { ...store.organization, updatedAt: store.organizationUpdatedAt.toISOString() } satisfies OrganizationSettings;
});

patch('/settings/organization', ({ req, user, body, now }) => {
  requirePermission(user, 'settings.update');
  const input = parse(updateOrganizationSchema, body);
  const store = db();
  const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  Object.assign(store.organization, changes);
  store.organizationUpdatedAt = now;
  addAudit(req, now, user.id, 'SETTINGS_UPDATED', 'ORGANIZATION', null, changes);
  return { ...store.organization, updatedAt: now.toISOString() } satisfies OrganizationSettings;
});

get('/settings/roles', ({ user }) => {
  requirePermission(user, 'settings.read');
  return {
    roles: SYSTEM_ROLES.map((key) => ({ key, name: ROLE_LABELS[key], permissions: [...ROLE_PERMISSIONS[key]] })),
    permissions: PERMISSIONS.map((key) => ({ key, description: PERMISSION_DESCRIPTIONS[key] })),
  } satisfies RoleMatrix;
});
