'use client';

import { ListChecks } from 'lucide-react';
import Link from 'next/link';
import { TaskRow } from '@/components/tasks/TaskRow';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTasks } from '@/hooks/useTasks';

/** The employee's open work, soonest deadline first (Frontend.md §24, §137). */
export function MyTasksCard({ className }: { className?: string }) {
  const tasks = useTasks({
    assigneeId: 'me',
    status: ['TODO', 'IN_PROGRESS', 'BLOCKED'],
    sort: 'dueAt',
    order: 'asc',
    page: 1,
    pageSize: 8,
  });

  return (
    <Card className={className}>
      <CardHeader
        title="My Tasks"
        description="Open work, soonest deadline first"
        action={
          <Link href="/tasks" className="text-meta font-medium text-primary-ink hover:underline">
            View all tasks
          </Link>
        }
      />
      <div className="px-5 pt-2 pb-3">
        {tasks.error ? (
          <ErrorState onRetry={() => tasks.refetch()} className="py-6" />
        ) : !tasks.data ? (
          <div className="grid gap-3 py-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : tasks.data.items.length === 0 ? (
          <EmptyState icon={ListChecks} title="No open tasks" description="Tasks assigned to you will appear here." className="py-8" />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {tasks.data.items.map((task) => (
              <TaskRow key={task.id} task={task} showAssignee={false} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
