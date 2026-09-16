import type { TaskActivityEntry } from '@zemp/shared';

/** "changed progress from 40% to 65%" — the actor's name is rendered separately. */
export function activityText(entry: Pick<TaskActivityEntry, 'type' | 'fromLabel' | 'toLabel'>): string {
  const { fromLabel: from, toLabel: to } = entry;
  switch (entry.type) {
    case 'CREATED':
      return 'created the task';
    case 'ASSIGNED':
      return `assigned it to ${to}`;
    case 'REASSIGNED':
      return `reassigned it from ${from} to ${to}`;
    case 'UPDATED':
      return `updated the ${to}`;
    case 'PRIORITY_CHANGED':
      return `changed priority from ${from} to ${to}`;
    case 'DUE_DATE_CHANGED':
      return `moved the due date to ${to}`;
    case 'STATUS_CHANGED':
      return `changed status from ${from} to ${to}`;
    case 'PROGRESS_CHANGED':
      return `updated progress from ${from} to ${to}`;
    case 'COMMENT_ADDED':
      return 'added a comment';
    case 'COMPLETED':
      return 'completed the task';
    case 'REOPENED':
      return 'reopened the task';
    case 'CANCELLED':
      return 'cancelled the task';
  }
}
