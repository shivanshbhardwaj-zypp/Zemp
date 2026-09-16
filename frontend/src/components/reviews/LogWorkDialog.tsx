'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { dayKey, fromDateTimeInput, selfReportSchema, toDateTimeInput, type TaskSummary } from '@zemp/shared';
import { CircleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useResubmitWork, useReviewerOptions, useSubmitWork } from '@/hooks/useReviews';
import { applyApiError, useLeaveGuard } from '@/lib/formErrors';
import { useTimeZone } from '@/lib/session';

const formSchema = z.object({
  title: selfReportSchema.shape.title,
  description: selfReportSchema.shape.description,
  evidenceUrl: z.string().trim(),
  completedAt: z.string().min(1, 'Choose when you finished'),
  reviewerId: z.string().min(1, 'Choose who should review this'),
});

type FormValues = z.infer<typeof formSchema>;
const FIELDS = ['title', 'description', 'evidenceUrl', 'completedAt', 'reviewerId'] as const;

/**
 * Employees log work nobody assigned and pick their reviewer — their team admin or the Super Admin
 * (requirements §39 "Approvals"). The same dialog revises a submission the reviewer sent back.
 */
export function LogWorkDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when revising work the reviewer returned. */
  task?: TaskSummary & { description?: string | null };
}) {
  const timeZone = useTimeZone();
  const router = useRouter();
  const submit = useSubmitWork();
  const resubmit = useResubmitWork(task?.id ?? '');
  const reviewers = useReviewerOptions(open);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const isRevision = Boolean(task);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      evidenceUrl: task?.evidenceUrl ?? '',
      completedAt: toDateTimeInput(task?.completedAt ? new Date(task.completedAt) : new Date(), timeZone),
      reviewerId: task?.review?.reviewer?.id ?? '',
    },
  });
  const { register, handleSubmit, setError, setValue, reset, formState } = form;
  const dirty = formState.isDirty && !formState.isSubmitSuccessful;
  useLeaveGuard(open && dirty);

  const close = () => {
    reset();
    setFormError(null);
    onOpenChange(false);
  };
  const requestClose = () => (dirty ? setConfirmLeave(true) : close());

  const today = dayKey(new Date(), timeZone);
  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const completedAt = fromDateTimeInput(values.completedAt, timeZone);
    if (completedAt > new Date()) {
      setError('completedAt', { message: 'You cannot log work finishing in the future' });
      return;
    }
    try {
      const saved = isRevision
        ? await resubmit.mutateAsync({
            title: values.title,
            description: values.description,
            evidenceUrl: values.evidenceUrl || null,
            completedAt: completedAt.toISOString(),
          })
        : await submit.mutateAsync({
            title: values.title,
            description: values.description,
            evidenceUrl: values.evidenceUrl || undefined,
            completedAt: completedAt.toISOString(),
            reviewerId: values.reviewerId,
          });
      toast.success(isRevision ? 'Sent back for review.' : 'Work submitted for review.', {
        action: { label: 'View', onClick: () => router.push(`/tasks/${saved.id}`) },
      });
      close();
    } catch (error) {
      setFormError(
        applyApiError(error, setError, [...FIELDS], {
          REVIEWER_OUT_OF_SCOPE: 'reviewerId',
          INVALID_COMPLETION_DATE: 'completedAt',
        }),
      );
    }
  };

  const options = reviewers.data ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <DialogContent
          title={isRevision ? 'Revise and resubmit' : 'Log completed work'}
          description={
            isRevision
              ? 'Update the details, then send it back to the same reviewer.'
              : 'Record work nobody assigned. It counts towards your progress once your reviewer approves it.'
          }
          className="max-w-xl"
        >
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
            {isRevision && task?.review?.note && (
              <div className="rounded-md border border-warning-border bg-warning-soft px-3.5 py-3 text-sm text-warning-ink">
                <p className="font-semibold">{task.review.reviewer?.name ?? 'Your reviewer'} asked for changes</p>
                <p className="mt-0.5">{task.review.note}</p>
              </div>
            )}

            <Field label="What did you do?" error={formState.errors.title?.message}>
              {(control) => (
                <Input {...control} {...register('title')} placeholder="e.g. Cleaned up the shared asset folder" autoFocus />
              )}
            </Field>

            <Field
              label="Details"
              hint="What you did and why — your reviewer reads this."
              error={formState.errors.description?.message}
            >
              {(control) => <Textarea {...control} {...register('description')} rows={4} />}
            </Field>

            <Field
              label="Link"
              hint="Optional — a document, folder or page that shows the work."
              error={formState.errors.evidenceUrl?.message}
            >
              {(control) => <Input {...control} {...register('evidenceUrl')} type="url" placeholder="https://" />}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Finished at" hint={`Times are in ${timeZone}.`} error={formState.errors.completedAt?.message}>
                {(control) => (
                  <div className="grid gap-2">
                    <Input {...control} {...register('completedAt')} type="datetime-local" />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8"
                        onClick={() => setValue('completedAt', toDateTimeInput(new Date(), timeZone), { shouldDirty: true })}
                      >
                        Just now
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8"
                        onClick={() => setValue('completedAt', `${today}T17:00`, { shouldDirty: true })}
                      >
                        Today, 5 PM
                      </Button>
                    </div>
                  </div>
                )}
              </Field>

              <Field
                label="Send to"
                error={formState.errors.reviewerId?.message}
                hint={isRevision ? 'Goes back to the same reviewer.' : 'Your team admin, or the Super Admin.'}
              >
                {(control) =>
                  isRevision ? (
                    <Input {...control} value={task?.review?.reviewer?.name ?? 'Your reviewer'} readOnly disabled />
                  ) : (
                    <Select {...control} {...register('reviewerId')} disabled={reviewers.isPending}>
                      <option value="">Choose a reviewer</option>
                      {options.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name} — {person.relationship === 'SUPER_ADMIN' ? 'Super Admin' : 'Team Admin'}
                        </option>
                      ))}
                    </Select>
                  )
                }
              </Field>
            </div>

            {formError && (
              <div
                role="alert"
                className="flex gap-2.5 rounded-md border border-danger-border bg-danger-soft px-3.5 py-3 text-sm text-danger-ink"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>Unable to submit this work. {formError}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="secondary" onClick={requestClose} disabled={formState.isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" loading={formState.isSubmitting}>
                {isRevision ? 'Resubmit' : 'Submit for review'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="You have unsaved changes"
        description="Leave without saving? What you entered will be lost."
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
