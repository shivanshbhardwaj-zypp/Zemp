'use client';

import type { TaskSummary } from '@zemp/shared';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { deadlineText } from '@/lib/format';
import { useTimeZone } from '@/lib/session';

/** Compact task line for attention lists: title, owner, deadline, status. */
export function TaskRow({ task, showAssignee = true }: { task: TaskSummary; showAssignee?: boolean }) {
  const timeZone = useTimeZone();
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <Link href={`/tasks/${task.id}`} className="block truncate text-sm font-medium text-ink hover:underline">
          {task.title}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-meta text-ink-muted">
          {showAssignee && (
            <>
              <span>{task.assignee.name}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span className={cn(task.isOverdue && 'font-medium text-danger-ink')}>{deadlineText(task, timeZone)}</span>
        </p>
      </div>
      <StatusBadge status={task.status} className="hidden sm:inline-flex" />
    </li>
  );
}
