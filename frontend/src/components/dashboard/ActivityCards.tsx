'use client';

import { History, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { UserAvatar } from '@/components/ui/Avatar';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { useActivityFeed } from '@/hooks/useReports';
import { activityText } from '@/lib/activityText';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useTimeZone } from '@/lib/session';

function ListSkeleton() {
  return (
    <div className="grid gap-3 py-3">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** Latest task events within the viewer's scope. */
export function RecentActivityCard({ title, className, employeeId }: { title: string; className?: string; employeeId?: string }) {
  const feed = useActivityFeed({ limit: 8, employeeId });
  const timeZone = useTimeZone();
  return (
    <Card className={className}>
      <CardHeader title={title} description="Latest changes to tasks" />
      <div className="px-5 pt-2 pb-4">
        {feed.error ? (
          <ErrorState onRetry={() => feed.refetch()} className="py-6" />
        ) : !feed.data ? (
          <ListSkeleton />
        ) : feed.data.length === 0 ? (
          <EmptyState icon={History} title="No activity yet" className="py-8" />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {feed.data.map((entry) => (
              <li key={entry.id} className="flex gap-3 py-3">
                <UserAvatar name={entry.actor.name} size="sm" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-ink-secondary">
                    <span className="font-medium text-ink">{entry.actor.name}</span> {activityText(entry)}
                  </p>
                  <p className="mt-0.5 flex min-w-0 items-center gap-2 text-meta text-ink-muted">
                    <Link href={`/tasks/${entry.task.id}`} className="truncate hover:underline">
                      {entry.task.title}
                    </Link>
                    <span aria-hidden>·</span>
                    <time dateTime={entry.createdAt} title={formatDateTime(entry.createdAt, timeZone)} className="shrink-0">
                      {formatRelative(entry.createdAt)}
                    </time>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/** Recent administrative changes for the Super Admin (Frontend.md §139). */
export function AdminChangesCard({ className }: { className?: string }) {
  const logs = useAuditLogs({ page: 1, pageSize: 6 });
  const timeZone = useTimeZone();
  return (
    <Card className={className}>
      <CardHeader
        title="Recent changes"
        description="From the audit log"
        action={
          <Link href="/audit" className="text-meta font-medium text-primary-ink hover:underline">
            Open audit log
          </Link>
        }
      />
      <div className="px-5 pt-2 pb-4">
        {logs.error ? (
          <ErrorState onRetry={() => logs.refetch()} className="py-6" />
        ) : !logs.data ? (
          <ListSkeleton />
        ) : logs.data.items.length === 0 ? (
          <EmptyState icon={ScrollText} title="No changes recorded yet" className="py-8" />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {logs.data.items.map((entry) => (
              <li key={entry.id} className="py-3">
                <p className="text-sm text-ink">{entry.summary}</p>
                <p className="mt-0.5 text-meta text-ink-muted">
                  {entry.actor?.name ?? 'System'} ·{' '}
                  <time dateTime={entry.createdAt} title={formatDateTime(entry.createdAt, timeZone)}>
                    {formatRelative(entry.createdAt)}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
