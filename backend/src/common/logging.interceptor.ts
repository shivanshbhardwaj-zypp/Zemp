import { CallHandler, ExecutionContext, Injectable, Logger, type NestInterceptor } from '@nestjs/common';
import { tap, type Observable } from 'rxjs';
import type { RequestContext } from './auth.js';

/** Slower than this and the line is logged at warn, so pathological requests stand out. */
const SLOW_REQUEST_MS = 500;

/**
 * One structured line per request: method, path, status, duration, correlation id and the acting
 * user. Never the body, the cookies or the Authorization header — those carry credentials and PII.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Request');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestContext>();
    const started = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.write(request, http.getResponse().statusCode, started),
        error: () => this.write(request, http.getResponse().statusCode, started),
      }),
    );
  }

  private write(request: RequestContext, status: number, started: bigint): void {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const line = JSON.stringify({
      requestId: request.requestId,
      method: request.method,
      // The path only: query strings can carry identifiers we would rather not retain in logs.
      path: request.path,
      status,
      durationMs: Math.round(durationMs * 10) / 10,
      userId: request.user?.id ?? null,
    });
    if (durationMs >= SLOW_REQUEST_MS) this.logger.warn(line);
    else this.logger.log(line);
  }
}
