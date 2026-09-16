'use client';

import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES, listAuditLogsQuerySchema, type AuditLogEntry } from '@zemp/shared';
import { ScrollText } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { AccessDenied, EmptyState } from '@/components/shared/States';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { parseSearchParams, useUrlParams } from '@/hooks/useUrlParams';
import { formatDateTime } from '@/lib/format';
import { useCan, useTimeZone } from '@/lib/session';

const humanize = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');

/** Append-only audit history — read-only in the UI (Frontend.md §88, requirements §20). */
export function AuditLogPage() {
  const can = useCan();
  const timeZone = useTimeZone();
  const [params, setParams] = useUrlParams();
  const query = useMemo(() => parseSearchParams(listAuditLogsQuerySchema, params), [params]);
  const logs = useAuditLogs(query);

  if (!can('audit.read')) return <AccessDenied />;

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'time',
      header: 'Date & time',
      cell: (e) => <span className="whitespace-nowrap text-ink-secondary tabular">{formatDateTime(e.createdAt, timeZone)}</span>,
    },
    { key: 'actor', header: 'Actor', cell: (e) => <span className="font-medium text-ink">{e.actor?.name ?? 'System / unknown'}</span> },
    {
      key: 'action',
      header: 'Action',
      cell: (e) => (
        <div className="min-w-0 max-w-[420px]">
          <p className="text-ink">{e.summary}</p>
          <p className="text-meta text-ink-muted">{humanize(e.action)}</p>
        </div>
      ),
    },
    { key: 'resource', header: 'Resource', cell: (e) => <span className="text-ink-secondary">{humanize(e.resourceType)}</span> },
    {
      key: 'result',
      header: 'Result',
      cell: (e) => <Badge tone={e.result === 'SUCCESS' ? 'success' : 'danger'}>{e.result === 'SUCCESS' ? 'Success' : 'Failure'}</Badge>,
    },
    { key: 'ip', header: 'IP address', cell: (e) => <span className="text-meta text-ink-muted tabular">{e.ip ?? '—'}</span> },
  ];

  return (
    <>
      <PageHeader title="Audit Log" description="Sign-ins, people, team and task changes. Entries cannot be edited." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select aria-label="Action" value={query.action ?? ''} onChange={(e) => setParams({ action: e.target.value })} className="sm:w-56 [&_select]:sm:h-9">
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {humanize(action)}
            </option>
          ))}
        </Select>
        <Select aria-label="Resource" value={query.resourceType ?? ''} onChange={(e) => setParams({ resourceType: e.target.value })} className="sm:w-44 [&_select]:sm:h-9">
          <option value="">All resources</option>
          {AUDIT_RESOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {humanize(type)}
            </option>
          ))}
        </Select>
        <Select aria-label="Result" value={query.result ?? ''} onChange={(e) => setParams({ result: e.target.value })} className="sm:w-40 [&_select]:sm:h-9">
          <option value="">Any result</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILURE">Failure</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          From
          <Input type="date" value={query.from ?? ''} onChange={(e) => setParams({ from: e.target.value })} className="h-9 w-40" />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          To
          <Input type="date" value={query.to ?? ''} onChange={(e) => setParams({ to: e.target.value })} className="h-9 w-40" />
        </label>
      </div>
      <DataTable
        caption="Audit log"
        columns={columns}
        rows={logs.data?.items}
        getRowId={(e) => e.id}
        loading={logs.isPending}
        error={logs.error}
        onRetry={() => logs.refetch()}
        minWidth="min-w-[980px]"
        empty={<EmptyState icon={ScrollText} title="No audit entries match these filters" />}
        footer={
          logs.data &&
          logs.data.meta.total > 0 && (
            <Pagination
              meta={logs.data.meta}
              noun="entries"
              onPageChange={(page) => setParams({ page }, { resetPage: false })}
              onPageSizeChange={(pageSize) => setParams({ pageSize })}
            />
          )
        }
      />
    </>
  );
}
