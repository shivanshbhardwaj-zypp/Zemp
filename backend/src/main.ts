import 'dotenv/config';
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { CONFIG, type AppConfig } from './config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<AppConfig>(CONFIG);
  const logger = new Logger('Bootstrap');

  // The API serves JSON only, so the strictest possible CSP applies.
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(cookieParser());
  app.set('trust proxy', 1); // Client IPs come from the proxy in front of the API.

  app.enableCors({
    origin: config.CORS_ORIGINS,
    credentials: true, // Session and CSRF cookies must travel with the request.
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks(); // Drain in-flight requests on SIGTERM instead of dropping them.

  if (!config.isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('ZEMP API')
        .setDescription(
          'Internal employee, team and task platform. Session cookie + double-submit CSRF header; ' +
            'every response is `{ success, data, meta? }` or `{ success: false, error }`.',
        )
        .setVersion('0.1')
        .addCookieAuth('zemp_session')
        .build(),
    );
    SwaggerModule.setup('api/v1/docs', app, document, { useGlobalPrefix: false });
    logger.log(`API docs on http://localhost:${config.PORT}/api/v1/docs`);
  }

  await app.listen(config.PORT);
  logger.log(`ZEMP API listening on http://localhost:${config.PORT}/api/v1 (${config.NODE_ENV})`);
}

void bootstrap();
