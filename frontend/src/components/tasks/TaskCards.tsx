'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import type { Page, TaskSummary } from '@zemp/shared';
import { ListChecks } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { PriorityLabel, StatusBadge } from '@/components/ui/Badge';
import { ProgressBar, toneForTask } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { deadlineText } from '@/lib/format';
import { useTimeZone } from '@/lib/session';
import { TaskActionsMenu } from './TaskActions';

/** Task cards replace the table on genuinely narrow screens (Frontend.md §69–70). */
export function TaskCards({
  tasks,
  onOpen,
  footer,
  className,
}: {
  tasks: UseQueryResult<Page<TaskSummary>>;
  onOpen: (task: TaskSummary) => void;
  footer?: React.ReactNode;
  className?: string;
}) {
  const timeZone = useTimeZone();

  if (tasks.isPending) {
    return (
      <div className={cn('grid gap-3', className)}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (tasks.error) return <ErrorState className={className} onRetry={() => tasks.refetch()} />;
  if (!tasks.data.items.length) {
    return <EmptyState className={className} icon={ListChecks} title="No tasks match these filters" description="Try clearing a filter." />;
  }

  return (
    <div className={className}>
      <ul className="grid gap-3">
        {tasks.data.items.map((task) => (
          <li key={task.id}>
            <article className="rounded-lg border border-border-subtle bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => onOpen(task)} className="text-left text-base font-semibold text-ink">
                  {task.title}
                </button>
                <TaskActionsMenu task={task} onView={() => onOpen(task)} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <PriorityLabel priority={task.priority} />
                <StatusBadge status={task.status} />
              </div>
              <p className="mt-3 text-sm text-ink-secondary">{task.assignee.name}</p>
              <ProgressBar className="mt-2" value={task.progress} label={`${task.title} progress`} tone={toneForTask(task)} />
              <p className={cn('mt-3 text-meta', task.isOverdue ? 'font-medium text-danger-ink' : 'text-ink-muted')}>
                {deadlineText(task, timeZone)}
              </p>
            </article>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle bg-surface">{footer}</div>}
    </div>
  );
}
