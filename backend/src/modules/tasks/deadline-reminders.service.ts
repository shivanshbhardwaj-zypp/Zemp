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
  check(): void {
    const now = new Date();
    const sentOfType = (type: 'DEADLINE_APPROACHING' | 'TASK_OVERDUE') =>
      new Set(this.store.notifications.filter((n) => n.type === type && n.taskId).map((n) => n.taskId!));

    const reminders = deadlineReminders(
      this.store.tasks,
      { deadlineApproaching: sentOfType('DEADLINE_APPROACHING'), overdue: sentOfType('TASK_OVERDUE') },
      now,
    );
    for (const reminder of reminders) {
      this.store.addNotification(
        { userId: reminder.userId, type: reminder.type, title: reminder.title, body: reminder.body },
        reminder.taskId,
        now,
      );
    }
    if (reminders.length) this.logger.log(`Sent ${reminders.length} deadline reminder(s).`);
  }
}
