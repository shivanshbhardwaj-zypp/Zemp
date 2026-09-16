'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import type { Page, TaskSummary } from '@zemp/shared';
import { ListChecks } from 'lucide-react';
import { DataTable, type Column, type SortState } from '@/components/shared/DataTable';
import { EmptyState } from '@/components/shared/States';
import { UserAvatar } from '@/components/ui/Avatar';
import { Badge, PriorityLabel, StatusBadge } from '@/components/ui/Badge';
import { ProgressBar, toneForTask } from '@/components/ui/ProgressBar';
import { cn } from '@/lib/cn';
import { deadlineText, formatDate } from '@/lib/format';
import { useTimeZone } from '@/lib/session';
import { TaskActionsMenu } from './TaskActions';

interface TaskTableProps {
  tasks: UseQueryResult<Page<TaskSummary>>;
  sort: SortState;
  onSort: (key: string) => void;
  onOpen: (task: TaskSummary) => void;
  selection?: { selected: ReadonlySet<string>; onToggle: (id: string) => void; onToggleAll: (ids: string[]) => void };
  footer?: React.ReactNode;
  className?: string;
}

/** Checkbox · Task · Assignee · Team · Priority · Status · Progress · Due · Actions (Frontend.md §31). */
export function TaskTable({ tasks, sort, onSort, onOpen, selection, footer, className }: TaskTableProps) {
  const timeZone = useTimeZone();

  const columns: Column<TaskSummary>[] = [
    {
      key: 'title',
      header: 'Task',
      sortKey: 'title',
      cell: (t) => (
        <div className="min-w-0 max-w-[320px]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(t);
            }}
            className="block max-w-full truncate rounded-xs text-left font-medium text-ink hover:underline"
          >
            {t.title}
          </button>
          <p className="truncate text-meta text-ink-muted">Assigned by {t.assignor.name}</p>
        </div>
      ),
    },
    {
      key: 'assignee',
      header: 'Assignee',
      cell: (t) => (
        <div className="flex min-w-0 items-center gap-2">
          <UserAvatar name={t.assignee.name} size="sm" />
          <span className="truncate text-ink-secondary">{t.assignee.name}</span>
          {!t.assignee.isActive && (
            <Badge tone="danger" className="h-6">
              Inactive
            </Badge>
          )}
        </div>
      ),
    },
    { key: 'team', header: 'Team', cell: (t) => <span className="text-ink-secondary">{t.team?.name ?? '—'}</span> },
    { key: 'priority', header: 'Priority', sortKey: 'priority', cell: (t) => <PriorityLabel priority={t.priority} /> },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (t) => <StatusBadge status={t.status} /> },
    {
      key: 'progress',
      header: 'Progress',
      sortKey: 'progress',
      className: 'w-40',
      cell: (t) => <ProgressBar value={t.progress} label={`${t.title} progress`} tone={toneForTask(t)} />,
    },
    {
      key: 'due',
      header: 'Due',
      sortKey: 'dueAt',
      cell: (t) => (
        <div className="whitespace-nowrap">
          <p className="text-ink tabular">{formatDate(t.dueAt, timeZone)}</p>
          <p className={cn('text-meta', t.isOverdue ? 'font-medium text-danger-ink' : 'text-ink-muted')}>
            {deadlineText(t, timeZone)}
          </p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-12',
      cell: (t) => <TaskActionsMenu task={t} onView={() => onOpen(t)} />,
    },
  ];

  return (
    <DataTable
      className={className}
      caption="Tasks"
      columns={columns}
      rows={tasks.data?.items}
      getRowId={(t) => t.id}
      loading={tasks.isPending}
      error={tasks.error}
      onRetry={() => tasks.refetch()}
      sort={sort}
      onSortChange={onSort}
      onRowClick={onOpen}
      selection={selection}
      minWidth="min-w-[1080px]"
      footer={footer}
      empty={
        <EmptyState
          icon={ListChecks}
          title="No tasks match these filters"
          description="Try clearing a filter, or assign new work to your team."
        />
      }
    />
  );
}
