'use client';

import { BellOff, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useMarkAllRead, useNotifications, useUnreadCount } from '@/hooks/useNotifications';
import { plural } from '@/lib/format';
import { NotificationRow } from './NotificationRow';

/** Full notification history with an unread filter (Frontend.md §49). */
export function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const list = useNotifications({ page, pageSize: 20, unread: filter === 'unread' || undefined });
  const unread = useUnreadCount().data?.count ?? 0;
  const markAll = useMarkAllRead();

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread ? `${plural(unread, 'unread notification')}` : 'You are all caught up'}
        actions={
          <Button variant="secondary" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck />
            Mark all as read
          </Button>
        }
      />
      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value as 'all' | 'unread');
          setPage(1);
        }}
      >
        <TabsList aria-label="Filter notifications" className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card className="max-w-3xl overflow-hidden">
        {list.error ? (
          <ErrorState onRetry={() => list.refetch()} />
        ) : !list.data ? (
          <div className="grid gap-3 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={BellOff} title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} description="Task assignments, deadlines and updates will appear here." />
        ) : (
          <>
            <ul className="divide-y divide-border-subtle">
              {list.data.items.map((n) => (
                <NotificationRow key={n.id} notification={n} />
              ))}
            </ul>
            {list.data.meta.totalPages > 1 && <Pagination meta={list.data.meta} noun="notifications" onPageChange={setPage} />}
          </>
        )}
      </Card>
    </>
  );
}
