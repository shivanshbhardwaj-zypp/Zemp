'use client';

import type { TaskStatus, TaskSummary } from '@zemp/shared';
import {
  CircleCheck,
  CircleX,
  EllipsisVertical,
  Ban,
  PanelRight,
  Pencil,
  Play,
  RotateCcw,
  SquareArrowOutUpRight,
  UserRoundPen,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { createContext, useContext, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Input';
import { useChangeStatus } from '@/hooks/useTasks';
import { ApiError } from '@/lib/api/client';
import { EditTaskDialog } from './EditTaskDialog';
import { ReassignDialog } from './ReassignDialog';

type TaskAction =
  | { kind: 'edit'; task: TaskSummary }
  | { kind: 'reassign'; task: TaskSummary }
  | { kind: 'status'; task: TaskSummary; to: TaskStatus };

const TaskActionContext = createContext<((action: TaskAction) => void) | null>(null);

/** Hosts the task dialogs once per page so rows, cards and detail views can open them. */
export function TaskActionsProvider({ children }: { children: React.ReactNode }) {
  const [action, setAction] = useState<TaskAction | null>(null);
  const close = () => setAction(null);
  return (
    <TaskActionContext value={setAction}>
      {children}
      {action?.kind === 'edit' && <EditTaskDialog taskId={action.task.id} onClose={close} />}
      {action?.kind === 'reassign' && <ReassignDialog task={action.task} onClose={close} />}
      {action?.kind === 'status' && <StatusChangeDialog task={action.task} to={action.to} onClose={close} />}
    </TaskActionContext>
  );
}

export function useTaskActions() {
  const open = useContext(TaskActionContext);
  if (!open) throw new Error('useTaskActions must be used inside <TaskActionsProvider>');
  return open;
}

export function transitionLabel(from: TaskStatus, to: TaskStatus): string {
  if (to === 'IN_PROGRESS') return from === 'TODO' ? 'Start task' : from === 'BLOCKED' ? 'Unblock task' : 'Reopen task';
  if (to === 'BLOCKED') return 'Mark as blocked';
  if (to === 'COMPLETED') return 'Complete task';
  return 'Cancel task';
}

export const transitionIcon = (from: TaskStatus, to: TaskStatus): LucideIcon =>
  to === 'COMPLETED' ? CircleCheck : to === 'BLOCKED' ? Ban : to === 'CANCELLED' ? CircleX : from === 'COMPLETED' ? RotateCcw : Play;

/** Starting and unblocking are one click; completing, blocking, cancelling and reopening confirm first. */
export function useStatusChange(task: TaskSummary) {
  const open = useTaskActions();
  const mutation = useChangeStatus(task.id);
  const change = (to: TaskStatus) => {
    if (to !== 'IN_PROGRESS' || task.status === 'COMPLETED') {
      open({ kind: 'status', task, to });
      return;
    }
    mutation.mutate(
      { status: to },
      {
        onSuccess: () => toast.success(task.status === 'BLOCKED' ? 'Task unblocked.' : 'Task started.'),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : 'This task could not be updated. Please try again.'),
      },
    );
  };
  return { change, pending: mutation.isPending };
}

/** Row menu with only the actions this user may take (Frontend.md §191). */
export function TaskActionsMenu({ task, onView }: { task: TaskSummary; onView?: () => void }) {
  const open = useTaskActions();
  const { change } = useStatusChange(task);
  const p = task.permissions;
  const transitions = task.allowedTransitions.filter((to) => to !== 'CANCELLED');

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${task.title}`} onClick={(e) => e.stopPropagation()}>
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        {onView && (
          <DropdownMenuItem onSelect={onView}>
            <PanelRight />
            View details
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={`/tasks/${task.id}`}>
            <SquareArrowOutUpRight />
            Open full page
          </Link>
        </DropdownMenuItem>
        {(p.canEdit || p.canReassign) && <DropdownMenuSeparator />}
        {p.canEdit && (
          <DropdownMenuItem onSelect={() => open({ kind: 'edit', task })}>
            <Pencil />
            Edit
          </DropdownMenuItem>
        )}
        {p.canReassign && (
          <DropdownMenuItem onSelect={() => open({ kind: 'reassign', task })}>
            <UserRoundPen />
            Reassign
          </DropdownMenuItem>
        )}
        {transitions.length > 0 && <DropdownMenuSeparator />}
        {transitions.map((to) => {
          const Icon = transitionIcon(task.status, to);
          return (
            <DropdownMenuItem key={to} onSelect={() => change(to)}>
              <Icon />
              {transitionLabel(task.status, to)}
            </DropdownMenuItem>
          );
        })}
        {p.canCancel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => change('CANCELLED')}>
              <CircleX />
              Cancel task
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const STATUS_DIALOG: Partial<
  Record<TaskStatus, { title: string; description: string; confirm: string; note: string; success: string; destructive?: boolean; keep?: string }>
> = {
  COMPLETED: {
    title: 'Complete task',
    description: 'The task is marked completed at 100% and the person who assigned it is notified.',
    confirm: 'Complete task',
    note: 'Completion note (optional)',
    success: 'Task completed.',
  },
  BLOCKED: {
    title: 'Mark task as blocked',
    description: 'The person who assigned it is notified so they can help unblock it.',
    confirm: 'Mark as blocked',
    note: 'What is blocking this task? (optional)',
    success: 'Task marked as blocked.',
  },
  CANCELLED: {
    title: 'Cancel this task?',
    description: 'The assignee is notified and the task can no longer be updated.',
    confirm: 'Cancel task',
    note: 'Reason (optional)',
    success: 'Task cancelled.',
    destructive: true,
    keep: 'Keep task',
  },
  IN_PROGRESS: {
    title: 'Reopen this task?',
    description: 'Progress drops to 99% and the assignee is notified that more work is needed.',
    confirm: 'Reopen task',
    note: 'Reason (optional)',
    success: 'Task reopened.',
  },
};

function StatusChangeDialog({ task, to, onClose }: { task: TaskSummary; to: TaskStatus; onClose: () => void }) {
  const mutation = useChangeStatus(task.id);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const config = STATUS_DIALOG[to];
  if (!config) return null;

  const confirm = () =>
    mutation.mutate(
      { status: to, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(config.success);
          onClose();
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : 'This task could not be updated. Please try again.'),
      },
    );

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={config.title}
      description={config.description}
      confirmLabel={config.confirm}
      cancelLabel={config.keep}
      destructive={config.destructive}
      loading={mutation.isPending}
      onConfirm={confirm}
    >
      <p className="-mt-2 truncate text-sm font-medium text-ink">{task.title}</p>
      <Field label={config.note} error={error}>
        {(control) => <Textarea {...control} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
    </ConfirmDialog>
  );
}
