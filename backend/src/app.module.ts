import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard, RequestContextInterceptor } from './common/auth.js';
import { ApiExceptionFilter, EnvelopeInterceptor } from './common/http.js';
import { LoggingInterceptor } from './common/logging.interceptor.js';
import { ConfigModule } from './config/config.module.js';
import { CONFIG, type AppConfig } from './config/env.js';
import { DataModule } from './data/data.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthController } from './modules/health/health.controller.js';
import { InboxModule } from './modules/inbox/inbox.module.js';
import { PeopleModule } from './modules/people/people.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { TeamsModule } from './modules/teams/teams.module.js';

/**
 * Cross-cutting behaviour is registered once, globally, so no endpoint can forget it:
 * request context → logging → rate limit → authentication/CSRF/permissions → handler → envelope,
 * with every escaping error shaped by the exception filter.
 */
@Module({
  imports: [
    ConfigModule,
    DataModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ name: 'default', limit: config.RATE_LIMIT_PER_MINUTE, ttl: 60_000 }],
      }),
    }),
    AuthModule,
    TasksModule,
    ReviewsModule,
    PeopleModule,
    TeamsModule,
    InboxModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
