'use client';

import { useQueryClient } from '@tanstack/react-query';
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, listTasksQuerySchema, type TaskPriority, type TaskSummary } from '@zemp/shared';
import { ClipboardPen, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { invalidateWorkData, useTasks } from '@/hooks/useTasks';
import { parseSearchParams, useUrlParams } from '@/hooks/useUrlParams';
import { tasksApi } from '@/lib/api/tasks';
import { plural } from '@/lib/format';
import { useCan, useUser } from '@/lib/session';
import { AssignTaskDialog } from './AssignTaskDialog';
import { TaskActionsProvider } from './TaskActions';
import { LogWorkDialog } from '@/components/reviews/LogWorkDialog';
import { TaskCards } from './TaskCards';
import { TaskFilters } from './TaskFilters';
import { TaskSheet } from './TaskSheet';
import { TaskTable } from './TaskTable';

export function TasksPage() {
  const user = useUser();
  const can = useCan();
  const [params, setParams] = useUrlParams();
  const query = useMemo(() => parseSearchParams(listTasksQuerySchema, params), [params]);
  const tasks = useTasks(query);
  const isEmployee = user.role === 'EMPLOYEE';

  // Selection belongs to the rows on screen; changing the list clears it.
  const listKey = JSON.stringify(query);
  const [selection, setSelection] = useState<{ key: string; ids: ReadonlySet<string> }>({ key: listKey, ids: new Set() });
  const selected = selection.key === listKey ? selection.ids : new Set<string>();
  const setSelected = (ids: ReadonlySet<string>) => setSelection({ key: listKey, ids });

  const openTask = (task: TaskSummary) => setParams({ task: task.id }, { resetPage: false });
  const sortBy = (key: string) =>
    setParams({ sort: key, order: query.sort === key && query.order === 'asc' ? 'desc' : 'asc' }, { resetPage: false });

  const pagination = tasks.data && tasks.data.meta.total > 0 && (
    <Pagination
      meta={tasks.data.meta}
      noun="tasks"
      onPageChange={(page) => setParams({ page }, { resetPage: false })}
      onPageSizeChange={(pageSize) => setParams({ pageSize })}
    />
  );

  return (
    <TaskActionsProvider>
      <PageHeader
        title={isEmployee ? 'My Tasks' : 'Tasks'}
        description={isEmployee ? 'Your assigned work, progress and deadlines' : 'Manage assigned work and deadlines'}
        actions={
          <>
            {can('tasks.selfReport') && (
              <Button variant="secondary" onClick={() => setParams({ log: 1 }, { resetPage: false })}>
                <ClipboardPen />
                Log completed work
              </Button>
            )}
            {can('tasks.create') && (
              <Button onClick={() => setParams({ assign: 1 }, { resetPage: false })}>
                <Plus />
                Assign Task
              </Button>
            )}
          </>
        }
      />
      <LogWorkDialog
        open={params.get('log') === '1'}
        onOpenChange={(open) => !open && setParams({ log: null }, { resetPage: false })}
      />
      <TaskFilters query={query} onChange={setParams} showTeam={!isEmployee} />
      {selected.size > 0 && tasks.data && (
        <BulkActionBar
          tasks={tasks.data.items.filter((t) => selected.has(t.id))}
          onClear={() => setSelected(new Set())}
        />
      )}
      <TaskTable
        className="hidden md:block"
        tasks={tasks}
        sort={{ key: query.sort, order: query.order }}
        onSort={sortBy}
        onOpen={openTask}
        selection={
          isEmployee
            ? undefined
            : {
                selected,
                onToggle: (id) => {
                  const next = new Set(selected);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  setSelected(next);
                },
                onToggleAll: (ids) => setSelected(ids.every((id) => selected.has(id)) ? new Set() : new Set(ids)),
              }
        }
        footer={pagination}
      />
      <TaskCards className="md:hidden" tasks={tasks} onOpen={openTask} footer={pagination} />
      <TaskSheet taskId={params.get('task')} onClose={() => setParams({ task: null }, { resetPage: false })} />
      <AssignTaskDialog
        open={params.get('assign') === '1'}
        onOpenChange={(open) => setParams({ assign: open ? 1 : null }, { resetPage: false })}
      />
    </TaskActionsProvider>
  );
}

/** Limited bulk editing (Frontend.md §81): only rows the viewer may edit are changed. */
function BulkActionBar({ tasks, onClear }: { tasks: TaskSummary[]; onClear: () => void }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const changePriority = async (priority: TaskPriority) => {
    const editable = tasks.filter((t) => t.permissions.canEdit && t.priority !== priority);
    setPending(true);
    const results = await Promise.allSettled(editable.map((t) => tasksApi.update(t.id, { priority })));
    setPending(false);
    await invalidateWorkData(queryClient);
    const updated = results.filter((r) => r.status === 'fulfilled').length;
    const skipped = tasks.length - updated;
    if (updated) toast.success(`${plural(updated, 'task')} set to ${TASK_PRIORITY_LABELS[priority]} priority.`);
    if (skipped) toast.message(`${plural(skipped, 'task')} unchanged`, { description: 'Already at that priority, finished, or outside your permissions.' });
    onClear();
  };

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-primary-muted bg-primary-selected px-4 py-2.5"
    >
      <p className="text-sm font-medium text-ink">{plural(tasks.length, 'task')} selected</p>
      <Select
        aria-label="Change priority of selected tasks"
        value=""
        disabled={pending}
        onChange={(e) => e.target.value && changePriority(e.target.value as TaskPriority)}
        className="w-48 [&_select]:h-9 [&_select]:bg-surface"
      >
        <option value="">Change priority…</option>
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {TASK_PRIORITY_LABELS[p]}
          </option>
        ))}
      </Select>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
        <X />
        Clear selection
      </Button>
    </div>
  );
}
