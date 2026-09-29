import { Module } from '@nestjs/common';
import { DailyTasksService } from './daily-tasks.service.js';
import { DigestController } from './digest.controller.js';
import { DeadlineRemindersService } from './deadline-reminders.service.js';
import { IncentivesController, TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

@Module({
  controllers: [TasksController, IncentivesController, DigestController],
  providers: [TasksService, DeadlineRemindersService, DailyTasksService],
  exports: [TasksService],
})
export class TasksModule {}
