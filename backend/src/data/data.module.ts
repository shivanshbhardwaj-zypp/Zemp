import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { StoreService } from './store.service.js';

/** The data layer, available everywhere: Postgres via Prisma, loaded once into StoreService. */
@Global()
@Module({
  providers: [PrismaService, StoreService],
  exports: [PrismaService, StoreService],
})
export class DataModule {}
