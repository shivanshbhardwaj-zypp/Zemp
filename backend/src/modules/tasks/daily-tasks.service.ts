import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DomainError, dayKey, toDateTimeInput, zonedTimeToUtc } from '@zemp/shared';
import { StoreService } from '../../data/store.service.js';
import { TasksService } from './tasks.service.js';

/**
 * Daily repeating tasks. The newest copy in a series carries `repeatsDaily`; once a day this
 * assigns a fresh copy (same work, same assignee, due at the same time of day) through the normal
 * create path — so validation, the "task assigned" email and the audit trail all apply — and moves
 * the flag onto it. Runs every 15 minutes and at startup, so a host that slept overnight catches
 * up as soon as it wakes; a series that already has today's copy is left alone.
 */
@Injectable()
export class DailyTasksService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DailyTasksService.name);
  private running = false;

  constructor(
    private readonly store: StoreService,
    private readonly tasks: TasksService,
  ) {}

  onApplicationBootstrap(): void {
    void this.run();
  }

  @Cron('*/15 * * * *')
  async run(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const tz = this.store.timeZone;
      const today = dayKey(now, tz);
      const due = this.store.tasks.filter(
        (t) => t.repeatsDaily && t.status !== 'CANCELLED' && dayKey(t.createdAt, tz) < today,
      );
      for (const previous of due) {
        let dueAt = zonedTimeToUtc(today, toDateTimeInput(previous.dueAt, tz).slice(11, 16), tz);
        if (dueAt <= now) dueAt = zonedTimeToUtc(today, '23:59', tz);
        if (dueAt <= now) continue; // the day is over; tomorrow's run picks it up
        try {
          const assignor = this.store.findUser(previous.assignorId);
          if (!assignor) throw new DomainError('FORBIDDEN', 'The person who set up this daily task no longer exists.');
          // ponytail: create-then-clear isn't atomic — a crash in between can yield a duplicate
          // copy for the day, never a lost series. Fine at this scale.
          await this.tasks.create(
            assignor,
            {
              title: previous.title,
              description: previous.description ?? undefined,
              assigneeId: previous.assigneeId,
              teamId: previous.teamId ?? undefined,
              priority: previous.priority,
              dueAt: dueAt.toISOString(),
              incentiveAmount: previous.incentiveAmount ?? undefined,
              repeatsDaily: true,
            },
            { ip: null, userAgent: 'daily-tasks' },
            now,
          );
        } catch (error) {
          // A rule now says no (assignee deactivated, moved out of scope…): end the series rather
          // than fail again every 15 minutes. Anything else (e.g. the database) is retried.
          if (!(error instanceof DomainError)) throw error;
          this.logger.warn(`Stopped daily task "${previous.title}": ${error.message}`);
        }
        previous.repeatsDaily = false;
        await this.store.saveTask(previous);
      }
      if (due.length) this.logger.log(`Processed ${due.length} daily task(s).`);
    } catch (error) {
      this.logger.error(`Daily tasks run failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
