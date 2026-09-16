'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ROLE_LABELS, TASK_PRIORITIES, TASK_PRIORITY_LABELS, addDays, createTaskSchema, dayKey, fromDateTimeInput } from '@zemp/shared';
import { CircleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAssignableUsers, useCreateTask } from '@/hooks/useTasks';
import { useTeamOptions } from '@/hooks/useTeams';
import { applyApiError, useLeaveGuard } from '@/lib/formErrors';
import { useTimeZone, useUser } from '@/lib/session';

const formSchema = z
  .object({
    title: createTaskSchema.shape.title,
    description: z.string().trim().max(5000),
    teamId: z.string(),
    assigneeId: z.string().min(1, 'Choose who will do this work'),
    priority: z.enum(TASK_PRIORITIES),
    startAt: z.string(),
    dueAt: z.string().min(1, 'Choose a due date'),
  })
  .refine((v) => !v.startAt || v.startAt <= v.dueAt, { path: ['dueAt'], message: 'The due date must be after the start date' });

type FormValues = z.infer<typeof formSchema>;

const EMPTY: FormValues = { title: '', description: '', teamId: '', assigneeId: '', priority: 'MEDIUM', startAt: '', dueAt: '' };

/** Assign Task (Frontend.md §36–37, §84): choices are filtered to the viewer's scope; the API decides. */
export function AssignTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const user = useUser();
  const timeZone = useTimeZone();
  const router = useRouter();
  const create = useCreateTask();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...EMPTY, teamId: user.role === 'ADMIN' && user.ownedTeams.length === 1 ? user.ownedTeams[0]!.id : '' },
  });
  const { register, handleSubmit, setError, setValue, reset, formState } = form;
  const teamId = useWatch({ control: form.control, name: 'teamId' });
  const teams = useTeamOptions(open);
  const assignees = useAssignableUsers({ teamId: teamId || undefined }, open);
  const dirty = formState.isDirty && !formState.isSubmitSuccessful;
  useLeaveGuard(open && dirty);

  const close = () => {
    reset();
    setFormError(null);
    onOpenChange(false);
  };
  const requestClose = () => (dirty ? setConfirmLeave(true) : close());

  const today = dayKey(new Date(), timeZone);
  const presets = [
    { label: 'Today, 6 PM', value: `${today}T18:00` },
    { label: 'Tomorrow', value: `${addDays(today, 1)}T18:00` },
    { label: 'In 3 days', value: `${addDays(today, 3)}T18:00` },
    { label: 'Next week', value: `${addDays(today, 7)}T18:00` },
  ].filter((preset) => fromDateTimeInput(preset.value, timeZone) > new Date());

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const dueAt = fromDateTimeInput(values.dueAt, timeZone);
    if (dueAt <= new Date()) {
      setError('dueAt', { message: 'Choose a due date in the future' });
      return;
    }
    try {
      const task = await create.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        assigneeId: values.assigneeId,
        teamId: values.teamId || undefined,
        priority: values.priority,
        startAt: values.startAt ? fromDateTimeInput(values.startAt, timeZone).toISOString() : undefined,
        dueAt: dueAt.toISOString(),
      });
      toast.success('Task assigned successfully.', {
        action: { label: 'View', onClick: () => router.push(`/tasks/${task.id}`) },
      });
      close();
    } catch (error) {
      setFormError(
        applyApiError(error, setError, ['title', 'description', 'teamId', 'assigneeId', 'priority', 'startAt', 'dueAt'], {
          ASSIGNEE_OUT_OF_SCOPE: 'assigneeId',
          ASSIGNEE_INACTIVE: 'assigneeId',
          INVALID_TEAM: 'teamId',
          INVALID_DUE_DATE: 'dueAt',
        }),
      );
    }
  };

  const people = assignees.data ?? [];
  const admins = people.filter((p) => p.role === 'ADMIN');
  const employees = people.filter((p) => p.role === 'EMPLOYEE');
  const scopeText =
    user.role === 'SUPER_ADMIN'
      ? 'You can assign work to any active admin or employee.'
      : `Assigning within ${user.ownedTeams.map((t) => t.name).join(', ') || 'your teams'}.`;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <DialogContent title="Assign Task" description={scopeText} className="max-w-xl">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
            <Field label="Task title" error={formState.errors.title?.message}>
              {(control) => <Input {...control} {...register('title')} placeholder="e.g. Prepare the weekly operations report" autoFocus />}
            </Field>
            <Field label="Description" hint="Optional — what does done look like?" error={formState.errors.description?.message}>
              {(control) => <Textarea {...control} {...register('description')} rows={3} />}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Team" error={formState.errors.teamId?.message}>
                {(control) => (
                  <Select
                    {...control}
                    {...register('teamId', {
                      onChange: () => setValue('assigneeId', '', { shouldDirty: true }),
                    })}
                  >
                    {user.role === 'SUPER_ADMIN' && <option value="">Any team</option>}
                    {user.role === 'ADMIN' && user.ownedTeams.length !== 1 && <option value="">All my teams</option>}
                    {(teams.data ?? []).map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field
                label="Assign to"
                error={formState.errors.assigneeId?.message}
                hint={assignees.isPending ? 'Loading people…' : people.length === 0 ? 'No one is available in this team.' : undefined}
              >
                {(control) => (
                  <Select {...control} {...register('assigneeId')} disabled={assignees.isPending}>
                    <option value="">Choose a person</option>
                    {admins.length > 0 && (
                      <optgroup label={`${ROLE_LABELS.ADMIN}s`}>
                        {admins.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.ownedTeams.length ? ` — ${p.ownedTeams.map((t) => t.name).join(', ')}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {employees.length > 0 && (
                      <optgroup label={`${ROLE_LABELS.EMPLOYEE}s`}>
                        {employees.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.team && !teamId ? ` — ${p.team.name}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Select>
                )}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
              <Field label="Start" hint="Optional" error={formState.errors.startAt?.message}>
                {(control) => <Input {...control} {...register('startAt')} type="datetime-local" />}
              </Field>
            </div>

            <Field label="Due date" hint={`Times are in ${timeZone}.`} error={formState.errors.dueAt?.message}>
              {(control) => (
                <div className="grid gap-2">
                  <Input {...control} {...register('dueAt')} type="datetime-local" />
                  <div className="flex flex-wrap gap-2">
                    {presets.map((preset) => (
                      <Button
                        key={preset.label}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8"
                        onClick={() => setValue('dueAt', preset.value, { shouldDirty: true, shouldValidate: true })}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </Field>

            {formError && (
              <div role="alert" className="flex gap-2.5 rounded-md border border-danger-border bg-danger-soft px-3.5 py-3 text-sm text-danger-ink">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>Unable to create task. {formError}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="secondary" onClick={requestClose} disabled={formState.isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" loading={formState.isSubmitting}>
                Assign Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="You have unsaved changes"
        description="Leave without saving? The task details you entered will be lost."
        confirmLabel="Leave without saving"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirmLeave(false);
          close();
        }}
      />
    </>
  );
}
