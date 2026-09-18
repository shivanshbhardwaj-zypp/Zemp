import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service.js';

/** Global so `StoreService` (in `DataModule`, itself global) can inject it without a module edge. */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
