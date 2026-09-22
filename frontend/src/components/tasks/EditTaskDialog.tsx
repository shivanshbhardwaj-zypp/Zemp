'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  createTaskSchema,
  fromDateTimeInput,
  toDateTimeInput,
  type TaskDetail,
  type UpdateTaskInput,
} from '@zemp/shared';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ErrorState } from '@/components/shared/States';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { useTask, useUpdateTask } from '@/hooks/useTasks';
import { applyApiError, useLeaveGuard } from '@/lib/formErrors';
import { useTimeZone } from '@/lib/session';

const formSchema = z
  .object({
    title: createTaskSchema.shape.title,
    description: z.string().trim().max(5000),
    priority: z.enum(TASK_PRIORITIES),
    startAt: z.string(),
    dueAt: z.string().min(1, 'Choose a due date'),
    incentiveAmount: z.string(),
  })
  .refine((v) => !v.startAt || v.startAt <= v.dueAt, { path: ['dueAt'], message: 'The due date must be after the start date' });

type FormValues = z.infer<typeof formSchema>;

export function EditTaskDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useTask(taskId);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title="Edit task" description="Changes are recorded in the task's activity history." className="max-w-xl">
        {task.error ? (
          <ErrorState onRetry={() => task.refetch()} />
        ) : !task.data ? (
          <div className="grid gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <EditTaskForm task={task.data} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditTaskForm({ task, onClose }: { task: TaskDetail; onClose: () => void }) {
  const timeZone = useTimeZone();
  const update = useUpdateTask(task.id);
  const [formError, setFormError] = useState<string | null>(null);
  const [hasIncentive, setHasIncentive] = useState(task.incentiveAmount !== null);
  const initial: FormValues = {
    title: task.title,
    description: task.description ?? '',
    priority: task.priority,
    startAt: task.startAt ? toDateTimeInput(new Date(task.startAt), timeZone) : '',
    dueAt: toDateTimeInput(new Date(task.dueAt), timeZone),
    incentiveAmount: task.incentiveAmount !== null ? String(task.incentiveAmount) : '',
  };
  const { register, handleSubmit, setError, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial,
  });
  useLeaveGuard(formState.isDirty && !formState.isSubmitSuccessful);

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const changes: UpdateTaskInput = {};
    if (values.title !== initial.title) changes.title = values.title;
    if (values.description !== initial.description) changes.description = values.description || null;
    if (values.priority !== initial.priority) changes.priority = values.priority;
    if (values.startAt !== initial.startAt) {
      changes.startAt = values.startAt ? fromDateTimeInput(values.startAt, timeZone).toISOString() : null;
    }
    if (values.dueAt !== initial.dueAt) {
      const dueAt = fromDateTimeInput(values.dueAt, timeZone);
      if (dueAt <= new Date()) {
        setError('dueAt', { message: 'Choose a due date in the future' });
        return;
      }
      changes.dueAt = dueAt.toISOString();
    }
    const incentiveAmount = Number(values.incentiveAmount);
    if (hasIncentive && values.incentiveAmount && !(incentiveAmount > 0)) {
      setError('incentiveAmount', { message: 'Enter an incentive amount greater than 0' });
      return;
    }
    const nextIncentive = hasIncentive && values.incentiveAmount ? incentiveAmount : null;
    if (nextIncentive !== task.incentiveAmount) changes.incentiveAmount = nextIncentive;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    try {
      await update.mutateAsync(changes);
      toast.success('Task updated.');
      onClose();
    } catch (error) {
      setFormError(
        applyApiError(error, setError, ['title', 'description', 'priority', 'startAt', 'dueAt', 'incentiveAmount'], {
          INVALID_DUE_DATE: 'dueAt',
        }),
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <Field label="Task title" error={formState.errors.title?.message}>
        {(control) => <Input {...control} {...register('title')} />}
      </Field>
      <Field label="Description" error={formState.errors.description?.message}>
        {(control) => <Textarea {...control} {...register('description')} rows={4} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Priority">
          {(control) => (
            <Select {...control} {...register('priority')}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Start" error={formState.errors.startAt?.message}>
          {(control) => <Input {...control} {...register('startAt')} type="datetime-local" />}
        </Field>
        <Field label="Due date" error={formState.errors.dueAt?.message}>
          {(control) => <Input {...control} {...register('dueAt')} type="datetime-local" />}
        </Field>
      </div>
      <p className="text-meta text-ink-muted">Times are in {timeZone}.</p>
      <div className="flex items-center gap-3">
        <Switch
          checked={hasIncentive}
          onCheckedChange={(checked) => {
            setHasIncentive(checked);
            if (!checked) setValue('incentiveAmount', '', { shouldDirty: true });
          }}
          aria-label="This task has an incentive"
        />
        <span className="text-sm font-medium text-ink">This task has an incentive</span>
      </div>
      {hasIncentive && (
        <Field label="Incentive amount (₹)" hint="Optional" error={formState.errors.incentiveAmount?.message}>
          {(control) => <Input {...control} {...register('incentiveAmount')} type="number" min={1} step={1} />}
        </Field>
      )}
      {formError && (
        <div role="alert" className="flex gap-2.5 rounded-md border border-danger-border bg-danger-soft px-3.5 py-3 text-sm text-danger-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      )}
      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={formState.isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={formState.isSubmitting}>
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}
