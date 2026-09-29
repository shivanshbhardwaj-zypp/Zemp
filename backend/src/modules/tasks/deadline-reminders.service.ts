import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { deadlineReminders } from '@zemp/shared';
import { StoreService } from '../../data/store.service.js';

/**
 * Due-soon and overdue tasks don't have a single moment something "happens" to trigger a
 * notification the way assigning or blocking a task does — someone has to periodically check the
 * clock. This does that, and only once per task per reminder type: `deadlineReminders` already
 * excludes tasks that have an existing notification of that type.
 */
@Injectable()
export class DeadlineRemindersService {
  private readonly logger = new Logger(DeadlineRemindersService.name);

  constructor(private readonly store: StoreService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async check(): Promise<void> {
    const now = new Date();
    const sentOfType = (type: 'DEADLINE_APPROACHING' | 'TASK_OVERDUE') =>
      new Set(this.store.notifications.filter((n) => n.type === type && n.taskId).map((n) => n.taskId!));

    const reminders = deadlineReminders(
      this.store.tasks,
      { deadlineApproaching: sentOfType('DEADLINE_APPROACHING'), overdue: sentOfType('TASK_OVERDUE') },
      now,
    );
    for (const reminder of reminders) {
      await this.store.addNotification(
        { userId: reminder.userId, type: reminder.type, title: reminder.title, body: reminder.body },
        reminder.taskId,
        now,
      );
      // The admins answerable for the task hear about it too: whoever assigned it, and the owner
      // of the team it belongs to — each once, and never the assignee a second time.
      const task = this.store.findTask(reminder.taskId);
      if (!task) continue;
      const assignee = this.store.findUser(task.assigneeId)?.name ?? 'Someone';
      const teamOwnerId = task.teamId ? this.store.findTeam(task.teamId)?.ownerId : null;
      const admins = new Set([task.assignorId, teamOwnerId].filter((id): id is string => !!id && id !== task.assigneeId));
      const overdue = reminder.type === 'TASK_OVERDUE';
      for (const adminId of admins) {
        await this.store.addNotification(
          {
            userId: adminId,
            type: reminder.type,
            title: overdue ? `${assignee} missed a deadline` : `${assignee}'s task is due within 24 hours`,
            body: overdue
              ? `"${task.title}", assigned to ${assignee}, is past its due date.`
              : `"${task.title}", assigned to ${assignee}, is due soon.`,
          },
          task.id,
          now,
        );
      }
    }
    if (reminders.length) this.logger.log(`Sent ${reminders.length} deadline reminder(s).`);
  }
}
