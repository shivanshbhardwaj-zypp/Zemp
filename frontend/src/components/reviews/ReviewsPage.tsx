'use client';

import { REVIEW_STATUSES, type ReviewStatus, type TaskSummary } from '@zemp/shared';
import { Check, ExternalLink, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { AccessDenied, EmptyState, ErrorState } from '@/components/shared/States';
import { UserAvatar } from '@/components/ui/Avatar';
import { ReviewBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useReviewDecision, useReviewQueue } from '@/hooks/useReviews';
import { useUrlParams } from '@/hooks/useUrlParams';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useCan, useTimeZone } from '@/lib/session';

const TABS: Array<{ value: ReviewStatus; label: string }> = [
  { value: 'PENDING', label: 'Awaiting review' },
  { value: 'CHANGES_REQUESTED', label: 'Returned' },
  { value: 'APPROVED', label: 'Approved' },
];

function ChangesDialog({ task, onOpenChange }: { task: TaskSummary | null; onOpenChange: (open: boolean) => void }) {
  const decide = useReviewDecision(task?.id ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!note.trim()) {
      setError('Tell the author what needs changing');
      return;
    }
    try {
      await decide.mutateAsync({ decision: 'REQUEST_CHANGES', note: note.trim() });
      toast.success('Sent back to the author.');
      setNote('');
      setError(null);
      onOpenChange(false);
    } catch {
      setError('That could not be sent. Try again.');
    }
  };

  return (
    <Dialog open={Boolean(task)} onOpenChange={onOpenChange}>
      <DialogContent title="Ask for changes" description={task?.title} className="max-w-lg">
        <Field label="What needs changing?" error={error ?? undefined}>
          {(control) => (
            <Textarea
              {...control}
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Add a note on where the numbers come from."
              autoFocus
            />
          )}
        </Field>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={decide.isPending}>
            Cancel
          </Button>
          <Button onClick={send} loading={decide.isPending}>
            Send back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionCard({ task, onRequestChanges }: { task: TaskSummary; onRequestChanges: () => void }) {
  const timeZone = useTimeZone();
  const decide = useReviewDecision(task.id);

  const approve = async () => {
    try {
      await decide.mutateAsync({ decision: 'APPROVE' });
      toast.success(`Approved "${task.title}".`);
    } catch {
      toast.error('That could not be approved. Try again.');
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/tasks/${task.id}`} className="text-base font-semibold text-ink hover:underline">
            {task.title}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-muted">
            <UserAvatar name={task.assignee.name} size="sm" />
            <span className="text-ink-secondary">{task.assignee.name}</span>
            {task.team && <span>· {task.team.name}</span>}
            <span>· finished {formatDateTime(task.completedAt ?? task.dueAt, timeZone)}</span>
            <span>· submitted {formatRelative(task.createdAt)}</span>
          </div>
        </div>
        {task.review && <ReviewBadge status={task.review.status} />}
      </div>

      {task.evidenceUrl && (
        <a
          href={task.evidenceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-3 inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-primary-ink hover:underline"
        >
          <ExternalLink className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{task.evidenceUrl}</span>
        </a>
      )}

      {task.review?.status === 'PENDING' && task.permissions.canReview && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={approve} loading={decide.isPending}>
            <Check className="size-4" aria-hidden />
            Approve
          </Button>
          <Button size="sm" variant="secondary" onClick={onRequestChanges} disabled={decide.isPending}>
            <Undo2 className="size-4" aria-hidden />
            Ask for changes
          </Button>
        </div>
      )}

      {task.review?.note && task.review.status !== 'PENDING' && (
        <p className="mt-3 rounded-md bg-surface-subtle px-3 py-2 text-sm text-ink-secondary">
          <span className="font-medium text-ink">Note:</span> {task.review.note}
        </p>
      )}
    </Card>
  );
}

/** The reviewer's queue: work employees logged and asked this person (or a Super Admin) to approve. */
export function ReviewsPage() {
  const canReview = useCan()('tasks.review');
  const [params, setParams] = useUrlParams();
  const [changesFor, setChangesFor] = useState<TaskSummary | null>(null);
  const requested = params.get('status') ?? '';
  const status = (REVIEW_STATUSES as readonly string[]).includes(requested) ? (requested as ReviewStatus) : 'PENDING';
  const page = Number(params.get('page') ?? 1) || 1;
  const queue = useReviewQueue({ status, page }, canReview);

  if (!canReview) return <AccessDenied />;

  const items = queue.data?.items ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader title="Reviews" description="Work your team logged themselves. Approving it adds it to their progress." />

      <Tabs value={status} onValueChange={(next) => setParams({ status: next === 'PENDING' ? null : next })}>
        <TabsList aria-label="Filter submissions">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {queue.isError ? (
        <ErrorState onRetry={() => queue.refetch()} />
      ) : queue.isPending ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={status === 'PENDING' ? 'Nothing waiting on you' : 'Nothing here yet'}
          description={
            status === 'PENDING' ? 'When someone logs work and asks you to review it, it appears here.' : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          {items.map((task) => (
            <SubmissionCard key={task.id} task={task} onRequestChanges={() => setChangesFor(task)} />
          ))}
        </div>
      )}

      {queue.data && queue.data.meta.totalPages > 1 && (
        <Card className="p-0">
          <Pagination
            meta={queue.data.meta}
            noun="submission"
            onPageChange={(next) => setParams({ page: next === 1 ? null : String(next) })}
          />
        </Card>
      )}

      <ChangesDialog task={changesFor} onOpenChange={(open) => !open && setChangesFor(null)} />
    </div>
  );
}
