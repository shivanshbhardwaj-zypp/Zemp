import { DAY_MS } from '../time.js';
import { isOpenStatus, type TaskRecord } from './tasks.js';

export type DeadlineReminderType = 'DEADLINE_APPROACHING' | 'TASK_OVERDUE';

export interface DeadlineReminder {
  taskId: string;
  userId: string;
  type: DeadlineReminderType;
  title: string;
  body: string;
}

/**
 * Open tasks that need a fresh deadline reminder right now: overdue ones, and ones due within a
 * day. `alreadySent` names task ids that already got that reminder, so a periodic check never
 * repeats itself — callers persist each returned reminder as a notification (and, from there, an
 * email) to keep that record.
 */
export function deadlineReminders(
  tasks: readonly Pick<TaskRecord, 'id' | 'title' | 'assigneeId' | 'status' | 'dueAt'>[],
  alreadySent: { deadlineApproaching: ReadonlySet<string>; overdue: ReadonlySet<string> },
  now: Date,
): DeadlineReminder[] {
  const reminders: DeadlineReminder[] = [];
  for (const task of tasks) {
    if (!isOpenStatus(task.status)) continue;
    const untilDue = task.dueAt.getTime() - now.getTime();
    if (untilDue <= 0) {
      if (alreadySent.overdue.has(task.id)) continue;
      reminders.push({
        taskId: task.id,
        userId: task.assigneeId,
        type: 'TASK_OVERDUE',
        title: 'Task overdue',
        body: `"${task.title}" is past its due date.`,
      });
    } else if (untilDue < DAY_MS) {
      if (alreadySent.deadlineApproaching.has(task.id)) continue;
      reminders.push({
        taskId: task.id,
        userId: task.assigneeId,
        type: 'DEADLINE_APPROACHING',
        title: 'Due within 24 hours',
        body: `"${task.title}" is due soon.`,
      });
    }
  }
  return reminders;
}
