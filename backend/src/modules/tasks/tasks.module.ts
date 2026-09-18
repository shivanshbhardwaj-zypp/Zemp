import { Module } from '@nestjs/common';
import { DeadlineRemindersService } from './deadline-reminders.service.js';
import { IncentivesController, TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

@Module({
  controllers: [TasksController, IncentivesController],
  providers: [TasksService, DeadlineRemindersService],
  exports: [TasksService],
})
export class TasksModule {}
