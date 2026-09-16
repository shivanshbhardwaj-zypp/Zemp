'use client';

import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMarkAllRead, useNotifications, useUnreadCount } from '@/hooks/useNotifications';
import { NotificationRow } from './NotificationRow';

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount().data?.count ?? 0;
  const list = useNotifications({ page: 1, pageSize: 8 }, { enabled: open });
  const markAll = useMarkAllRead();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute top-2 right-2 size-2 rounded-full bg-primary ring-2 ring-canvas" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(380px,calc(100vw-32px))] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <p className="text-sm font-semibold text-ink">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            className="-mr-2 h-8"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck />
            Mark all read
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {list.isPending ? (
            <div className="grid gap-3 p-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : list.error ? (
            <p className="p-4 text-sm text-ink-muted">Notifications couldn&apos;t be loaded.</p>
          ) : list.data.items.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-muted">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {list.data.items.map((notification) => (
                <NotificationRow key={notification.id} notification={notification} onNavigate={() => setOpen(false)} />
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-border-subtle p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
