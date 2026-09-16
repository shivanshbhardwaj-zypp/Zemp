'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ListAuditLogsQuery } from '@zemp/shared';
import { auditApi } from '@/lib/api/audit';

export function useAuditLogs(query: Partial<ListAuditLogsQuery>) {
  return useQuery({
    queryKey: ['audit', query],
    queryFn: () => auditApi.list(query),
    placeholderData: keepPreviousData,
  });
}
