'use client';

import { History, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ErrorState } from '@/components/shared/States';
import { UserAvatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useAddComment, useTaskActivity, useTaskComments } from '@/hooks/useTasks';
import { activityText } from '@/lib/activityText';
import { ApiError } from '@/lib/api/client';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useTimeZone } from '@/lib/session';

/** Comments and the immutable activity history for one task (Frontend.md §38). */
export function TaskConversation({ taskId, canComment, commentCount }: { taskId: string; canComment: boolean; commentCount: number }) {
  return (
    <Tabs defaultValue="comments">
      <TabsList aria-label="Task conversation">
        <TabsTrigger value="comments">
          <MessageSquare className="size-4" aria-hidden />
          Comments
          <span className="rounded-full bg-surface-muted px-1.5 text-xs font-semibold text-ink-secondary tabular">{commentCount}</span>
        </TabsTrigger>
        <TabsTrigger value="activity">
          <History className="size-4" aria-hidden />
          Activity
        </TabsTrigger>
      </TabsList>
      <TabsContent value="comments" className="pt-4 outline-none">
        <Comments taskId={taskId} canComment={canComment} />
      </TabsContent>
      <TabsContent value="activity" className="pt-4 outline-none">
        <ActivityTimeline taskId={taskId} />
      </TabsContent>
    </Tabs>
  );
}

function Comments({ taskId, canComment }: { taskId: string; canComment: boolean }) {
  const timeZone = useTimeZone();
  const comments = useTaskComments(taskId);
  const add = useAddComment(taskId);
  const [body, setBody] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    add.mutate(
      { body: body.trim() },
      {
        onSuccess: () => setBody(''),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Your comment could not be posted.'),
      },
    );
  };

  return (
    <div className="grid gap-4">
      {comments.error ? (
        <ErrorState onRetry={() => comments.refetch()} className="py-6" />
      ) : !comments.data ? (
        <Skeleton className="h-20 w-full" />
      ) : comments.data.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No comments yet" description="Questions and updates about this task will appear here." className="py-6" />
      ) : (
        <ul className="grid gap-4">
          {comments.data.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <UserAvatar name={comment.author.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold text-ink">{comment.author.name}</span>{' '}
                  <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt, timeZone)} className="text-meta text-ink-muted">
                    {formatRelative(comment.createdAt)}
                  </time>
                </p>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words text-ink-secondary">{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canComment && (
        <form onSubmit={submit} className="grid gap-2">
          <label htmlFor={`comment-${taskId}`} className="sr-only">
            Add a comment
          </label>
          <Textarea
            id={`comment-${taskId}`}
            rows={3}
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={add.isPending} disabled={!body.trim()}>
              Comment
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function ActivityTimeline({ taskId }: { taskId: string }) {
  const timeZone = useTimeZone();
  const activity = useTaskActivity(taskId);
  if (activity.error) return <ErrorState onRetry={() => activity.refetch()} className="py-6" />;
  if (!activity.data) return <Skeleton className="h-32 w-full" />;
  if (activity.data.length === 0) return <EmptyState icon={History} title="No activity yet" className="py-6" />;
  return (
    <ol className="ml-1.5 border-l border-border-subtle">
      {activity.data.map((entry) => (
        <li key={entry.id} className="relative pb-4 pl-5 last:pb-0">
          <span className="absolute top-1.5 -left-[5px] size-2.5 rounded-full border-2 border-surface bg-border-strong" aria-hidden />
          <p className="text-sm text-ink-secondary">
            <span className="font-medium text-ink">{entry.actor.name}</span> {activityText(entry)}
          </p>
          {entry.note && <p className="mt-0.5 text-meta text-ink-muted">“{entry.note}”</p>}
          <time dateTime={entry.createdAt} title={formatDateTime(entry.createdAt, timeZone)} className="text-xs text-ink-muted">
            {formatRelative(entry.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}
