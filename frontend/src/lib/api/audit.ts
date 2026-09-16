import type { AuditLogEntry, ListAuditLogsQuery } from '@zemp/shared';
import { api } from './client';

export const auditApi = {
  list: (query: Partial<ListAuditLogsQuery>) => api.page<AuditLogEntry>('/audit-logs', query),
};
