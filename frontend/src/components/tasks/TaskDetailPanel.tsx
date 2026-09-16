'use client';

import type { TaskDetail } from '@zemp/shared';
import { Clock, Pencil, SearchX, UserRoundPen } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Breadcrumbs } from '@/components/shared/PageHeader';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { UserAvatar } from '@/components/ui/Avatar';
import { Badge, PriorityLabel, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ProgressBar, toneForTask } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTask, useUpdateProgress } from '@/hooks/useTasks';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { deadlineText, formatDateTime } from '@/lib/format';
import { useTimeZone } from '@/lib/session';
import { TaskActionsMenu, TaskActionsProvider, transitionIcon, transitionLabel, useStatusChange, useTaskActions } from './TaskActions';
import { TaskConversation } from './TaskConversation';

/** Full-page task view (Frontend.md §38). */
export function TaskDetailPage({ taskId }: { taskId: string }) {
  return (
    <TaskActionsProvider>
      <TaskDetailPanel taskId={taskId} variant="page" />
    </TaskActionsProvider>
  );
}

export function TaskDetailPanel({ taskId, variant }: { taskId: string; variant: 'sheet' | 'page' }) {
  const task = useTask(taskId);

  if (task.error) {
    // A task outside the viewer's scope looks exactly like a missing one (Frontend.md §150).
    const unavailable = task.error instanceof ApiError && [403, 404].includes(task.error.status);
    return unavailable ? (
      <EmptyState
        icon={SearchX}
        title="This task isn't available"
        description="It may have been removed, or it isn't part of the work you can see."
        action={
          <Button asChild variant="secondary">
            <Link href="/tasks">Back to tasks</Link>
          </Button>
        }
        className="min-h-[50dvh]"
      />
    ) : (
      <ErrorState description="We couldn't load this task." onRetry={() => task.refetch()} className="min-h-[50dvh]" />
    );
  }

  if (!task.data) return <DetailSkeleton />;
  const t = task.data;

  if (variant === 'sheet') {
    return (
      <div className="grid gap-6 p-6">
        <TaskHeader task={t} variant="sheet" />
        <ProgressSection task={t} />
        <StatusActions task={t} />
        <DetailsList task={t} />
        <Description task={t} />
        <TaskConversation taskId={t.id} canComment={t.permissions.canComment} commentCount={t.commentCount} />
      </div>
    );
  }

  return (
    <>
      <Breadcrumbs items={[{ label: 'Tasks', href: '/tasks' }, { label: t.title }]} className="mb-4" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 content-start gap-6">
          <Card className="grid gap-6 p-6">
            <TaskHeader task={t} variant="page" />
            <Description task={t} />
            <ProgressSection task={t} />
            <StatusActions task={t} />
          </Card>
          <Card className="p-6">
            <TaskConversation taskId={t.id} canComment={t.permissions.canComment} commentCount={t.commentCount} />
          </Card>
        </div>
        <aside className="content-start">
          <DetailsList task={t} />
        </aside>
      </div>
    </>
  );
}

function TaskHeader({ task, variant }: { task: TaskDetail; variant: 'sheet' | 'page' }) {
  const timeZone = useTimeZone();
  const open = useTaskActions();
  const Heading = variant === 'page' ? 'h1' : 'h2';
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          <PriorityLabel priority={task.priority} />
          {task.isOverdue && (
            <Badge tone="danger" icon={Clock}>
              Overdue
            </Badge>
          )}
        </div>
        <TaskActionsMenu task={task} />
      </div>
      <Heading className={cn('mt-3 font-semibold tracking-tight text-ink', variant === 'page' ? 'text-2xl' : 'text-xl')}>{task.title}</Heading>
      <p className={cn('mt-1 text-sm', task.isOverdue ? 'font-medium text-danger-ink' : 'text-ink-muted')}>{deadlineText(task, timeZone)}</p>
      {(task.permissions.canEdit || task.permissions.canReassign) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {task.permissions.canEdit && (
            <Button variant="secondary" size="sm" onClick={() => open({ kind: 'edit', task })}>
              <Pencil />
              Edit
            </Button>
          )}
          {task.permissions.canReassign && (
            <Button variant="secondary" size="sm" onClick={() => open({ kind: 'reassign', task })}>
              <UserRoundPen />
              Reassign
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Description({ task }: { task: TaskDetail }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink">Description</h3>
      {task.description ? (
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-ink-secondary">{task.description}</p>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">No description.</p>
      )}
      {task.completionNote && (
        <div className="mt-4 rounded-md border border-success-border bg-success-soft px-3.5 py-3 text-sm text-success-ink">
          <p className="font-semibold">Completion note</p>
          <p className="mt-0.5 whitespace-pre-wrap">{task.completionNote}</p>
        </div>
      )}
    </section>
  );
}

/** Slider, numeric input and quick buttons, saved explicitly (Frontend.md §64, §142). */
function ProgressSection({ task }: { task: TaskDetail }) {
  const mutation = useUpdateProgress(task.id);
  const [draft, setDraft] = useState<{ base: number; value: number }>({ base: task.progress, value: task.progress });
  const value = draft.base === task.progress ? draft.value : task.progress;
  const setValue = (next: number) => setDraft({ base: task.progress, value: Math.min(100, Math.max(0, Math.round(next))) });
  const dirty = value !== task.progress;

  if (!task.permissions.canUpdateProgress) {
    return (
      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">Progress</h3>
        <ProgressBar value={task.progress} label="Task progress" tone={toneForTask(task)} />
      </section>
    );
  }

  const save = () =>
    mutation.mutate(value, {
      onSuccess: (updated) =>
        toast.success(updated.status === 'COMPLETED' ? 'Task completed.' : `Progress saved at ${updated.progress}%.`),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Progress could not be saved. Please try again.'),
    });

  return (
    <section>
      <div className="flex items-center justify-between">
        <label htmlFor={`progress-${task.id}`} className="text-sm font-semibold text-ink">
          Progress
        </label>
        <span className="text-sm font-semibold text-ink tabular">{value}%</span>
      </div>
      <input
        id={`progress-${task.id}`}
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-valuetext={`${value} percent`}
        className="mt-3 h-2 w-full cursor-pointer accent-primary-strong"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor={`progress-number-${task.id}`} className="sr-only">
          Progress percentage
        </label>
        <Input
          id={`progress-number-${task.id}`}
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="h-9 w-20 tabular"
        />
        {[25, 50, 75, 100].map((quick) => (
          <Button key={quick} variant="secondary" size="sm" className="h-9" onClick={() => setValue(quick)}>
            {quick}%
          </Button>
        ))}
        <Button size="sm" className="ml-auto h-9" disabled={!dirty} loading={mutation.isPending} onClick={save}>
          Save progress
        </Button>
      </div>
      {dirty && value === 100 && <p className="mt-2 text-meta text-ink-muted">Saving 100% marks the task as completed.</p>}
    </section>
  );
}

/** Only transitions the server allows for this user are offered (Frontend.md §65). */
function StatusActions({ task }: { task: TaskDetail }) {
  const timeZone = useTimeZone();
  const { change, pending } = useStatusChange(task);
  const transitions = task.allowedTransitions.filter((to) => to !== 'CANCELLED');

  if (task.status === 'CANCELLED') {
    return <p className="rounded-md bg-surface-muted px-3.5 py-3 text-sm text-ink-secondary">This task was cancelled and can no longer be updated.</p>;
  }
  if (transitions.length === 0) {
    return task.status === 'COMPLETED' && task.completedAt ? (
      <p className="rounded-md bg-success-soft px-3.5 py-3 text-sm text-success-ink">Completed {formatDateTime(task.completedAt, timeZone)}.</p>
    ) : null;
  }
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-ink">Status</h3>
      <div className="flex flex-wrap gap-2">
        {transitions.map((to) => {
          const Icon = transitionIcon(task.status, to);
          return (
            <Button key={to} variant={to === 'COMPLETED' ? 'primary' : 'secondary'} size="sm" disabled={pending} onClick={() => change(to)}>
              <Icon />
              {transitionLabel(task.status, to)}
            </Button>
          );
        })}
      </div>
    </section>
  );
}

function DetailsList({ task }: { task: TaskDetail }) {
  const timeZone = useTimeZone();
  const person = (ref: TaskDetail['assignee']) => (
    <span className="flex items-center gap-2">
      <UserAvatar name={ref.name} size="sm" />
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{ref.name}</span>
        {ref.jobTitle && <span className="block truncate text-meta text-ink-muted">{ref.jobTitle}</span>}
      </span>
    </span>
  );
  const rows: Array<[string, React.ReactNode]> = [
    ['Assignee', person(task.assignee)],
    ['Team', task.team?.name ?? '—'],
    ['Assigned by', person(task.assignor)],
    ['Created', formatDateTime(task.createdAt, timeZone)],
    ['Start', task.startAt ? formatDateTime(task.startAt, timeZone) : '—'],
    ['Due', formatDateTime(task.dueAt, timeZone)],
    ...(task.completedAt ? ([['Completed', formatDateTime(task.completedAt, timeZone)]] as Array<[string, React.ReactNode]>) : []),
    ['Last updated', `${formatDateTime(task.updatedAt, timeZone)} by ${task.updatedBy.name}`],
  ];
  return (
    <dl className="grid gap-4 rounded-lg border border-border-subtle bg-surface-subtle p-4 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1">
          <dt className="text-meta text-ink-muted">{label}</dt>
          <dd className="min-w-0 text-ink-secondary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-5 p-6" aria-busy="true">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
