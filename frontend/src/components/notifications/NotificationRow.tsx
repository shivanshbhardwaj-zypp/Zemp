'use client';

import type { NotificationItem } from '@zemp/shared';
import { useRouter } from 'next/navigation';
import { useMarkRead } from '@/hooks/useNotifications';
import { cn } from '@/lib/cn';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useTimeZone } from '@/lib/session';

export function NotificationRow({ notification, onNavigate }: { notification: NotificationItem; onNavigate?: () => void }) {
  const router = useRouter();
  const markRead = useMarkRead();
  const timeZone = useTimeZone();
  const unread = !notification.readAt;

  const open = () => {
    if (unread) markRead.mutate(notification.id);
    if (notification.task) {
      onNavigate?.();
      router.push(`/tasks/${notification.task.id}`);
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={open}
        className="flex w-full gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-row"
      >
        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', unread ? 'bg-primary' : 'bg-transparent')} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm', unread ? 'font-semibold text-ink' : 'font-medium text-ink-secondary')}>
            {notification.title}
            {unread && <span className="sr-only"> (unread)</span>}
          </span>
          {notification.body && <span className="mt-0.5 line-clamp-2 block text-meta text-ink-muted">{notification.body}</span>}
          <time
            dateTime={notification.createdAt}
            title={formatDateTime(notification.createdAt, timeZone)}
            className="mt-1 block text-xs text-ink-muted"
          >
            {formatRelative(notification.createdAt)}
          </time>
        </span>
      </button>
    </li>
  );
}
