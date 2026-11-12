'use client';

import { useQueryClient } from '@tanstack/react-query';
import { OPEN_TASK_STATUSES, type TaskSummary } from '@zemp/shared';
import { Pencil, Repeat, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Pagination } from '@/components/shared/Pagination';
import { SearchInput } from '@/components/shared/SearchInput';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { invalidateWorkData, useDeleteTask, useTasks } from '@/hooks/useTasks';
import { ApiError } from '@/lib/api/client';
import { tasksApi } from '@/lib/api/tasks';
import { deadlineText } from '@/lib/format';
import { useCan, useTimeZone } from '@/lib/session';
import { useTaskActions } from './TaskActions';

const STATUS_FILTERS = {
  open: { label: 'Open', status: [...OPEN_TASK_STATUSES] },
  COMPLETED: { label: 'Completed', status: ['COMPLETED' as const] },
  CANCELLED: { label: 'Cancelled', status: ['CANCELLED' as const] },
  all: { label: 'All statuses', status: undefined },
};
type StatusFilter = keyof typeof STATUS_FILTERS;

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');

/** Everything the viewer assigned: manage daily repeats, edit, cancel or delete in one place. */
export function AssignedByMeDialog({
  open,
  onOpenChange,
  onOpenTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTask: (task: TaskSummary) => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [dailyOnly, setDailyOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [toDelete, setToDelete] = useState<TaskSummary | null>(null);

  const tasks = useTasks(
    {
      assignorId: 'me',
      search: search || undefined,
      status: STATUS_FILTERS[statusFilter].status,
      sort: 'dueAt',
      order: 'asc',
      page,
      pageSize,
    },
    { enabled: open },
  );
  const deleteTask = useDeleteTask();
  // shortcut: "Daily only" filters the loaded page client-side; add a server filter if lists outgrow one page.
  const items = (tasks.data?.items ?? []).filter((t) => !dailyOnly || t.repeatsDaily);

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          title="Tasks assigned by you"
          description="Turn daily repeats on or off, edit, cancel or delete the work you've handed out."
          className="max-w-3xl"
        >
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={resetPage(setSearch)}
              label="Search tasks you assigned"
              placeholder="Search tasks..."
              className="min-w-48 flex-1"
            />
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => resetPage(setStatusFilter)(e.target.value as StatusFilter)}
              className="w-40"
            >
              {Object.entries(STATUS_FILTERS).map(([key, f]) => (
                <option key={key} value={key}>
                  {f.label}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <Switch checked={dailyOnly} onCheckedChange={setDailyOnly} aria-label="Show daily repeating tasks only" />
              Daily only
            </label>
          </div>

          <div className="mt-3 max-h-[55vh] overflow-y-auto rounded-lg border border-line">
            {tasks.isPending ? (
              <p className="p-6 text-center text-sm text-ink-muted">Loading tasks…</p>
            ) : tasks.isError ? (
              <p className="p-6 text-center text-sm text-danger">These tasks couldn&apos;t be loaded. Please try again.</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-muted">
                {dailyOnly ? 'No daily repeating tasks match.' : 'No tasks you assigned match these filters.'}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((task) => (
                  <AssignedTaskRow
                    key={task.id}
                    task={task}
                    onOpen={() => {
                      onOpenChange(false);
                      onOpenTask(task);
                    }}
                    onDelete={() => setToDelete(task)}
                  />
                ))}
              </ul>
            )}
          </div>

          {tasks.data && tasks.data.meta.total > 0 && (
            <Pagination
              meta={tasks.data.meta}
              noun="tasks"
              onPageChange={setPage}
              onPageSizeChange={resetPage(setPageSize)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(next) => !next && setToDelete(null)}
        title="Delete this task permanently?"
        description={`"${toDelete?.title ?? ''}" for ${toDelete?.assignee.name ?? ''} will be removed with its comments and history. This can't be undone${
          toDelete?.repeatsDaily ? ', and no more daily copies will be created' : ''
        }. To keep the record, cancel the task instead.`}
        confirmLabel="Delete task"
        destructive
        loading={deleteTask.isPending}
        onConfirm={() =>
          toDelete &&
          deleteTask.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success('Task deleted.');
              setToDelete(null);
            },
            onError: (error) => toast.error(errorText(error)),
          })
        }
      />
    </>
  );
}

function AssignedTaskRow({ task, onOpen, onDelete }: { task: TaskSummary; onOpen: () => void; onDelete: () => void }) {
  const timeZone = useTimeZone();
  const can = useCan();
  const openAction = useTaskActions();
  const queryClient = useQueryClient();
  const [savingRepeat, setSavingRepeat] = useState(false);
  const p = task.permissions;

  const setRepeat = async (repeatsDaily: boolean) => {
    setSavingRepeat(true);
    try {
      await tasksApi.update(task.id, { repeatsDaily });
      await invalidateWorkData(queryClient);
      toast.success(repeatsDaily ? 'Daily repeat turned on.' : 'Daily repeat turned off — no new copies from tomorrow.');
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSavingRepeat(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2 font-medium text-ink">
          <span className="truncate">{task.title}</span>
          {task.repeatsDaily && <Repeat aria-label="Repeats daily" className="size-3.5 shrink-0 text-primary" />}
        </span>
        <span className="block truncate text-xs text-ink-muted">
          {task.assignee.name} · {deadlineText(task, timeZone)}
        </span>
      </button>

      <StatusBadge status={task.status} />

      {p.canEdit && (
        <label className="flex items-center gap-2 text-xs text-ink-muted" title="Create a fresh copy of this task every day">
          <Switch
            checked={task.repeatsDaily}
            disabled={savingRepeat}
            onCheckedChange={setRepeat}
            aria-label={`Repeat "${task.title}" daily`}
          />
          Daily
        </label>
      )}

      <div className="flex items-center gap-1">
        {p.canEdit && (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${task.title}`} onClick={() => openAction({ kind: 'edit', task })}>
            <Pencil />
          </Button>
        )}
        {p.canCancel && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Cancel ${task.title}`}
            onClick={() => openAction({ kind: 'status', task, to: 'CANCELLED' })}
          >
            <XCircle />
          </Button>
        )}
        {p.canDelete && can('tasks.delete') && (
          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${task.title}`} onClick={onDelete} className="text-danger">
            <Trash2 />
          </Button>
        )}
      </div>
    </li>
  );
}
