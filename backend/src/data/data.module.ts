import { Global, Module } from '@nestjs/common';
import { StoreService } from './store.service.js';

/**
 * The data layer, available everywhere. Phase C replaces `StoreService` with Prisma-backed
 * repositories here; no module that depends on it has to change.
 */
@Global()
@Module({
  providers: [StoreService],
  exports: [StoreService],
})
export class DataModule {}
