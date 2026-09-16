import { Global, Module } from '@nestjs/common';
import { CONFIG, loadConfig } from './env.js';

/** Validated configuration, available to every module — including ones bootstrapped asynchronously. */
@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: () => loadConfig() }],
  exports: [CONFIG],
})
export class ConfigModule {}
