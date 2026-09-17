import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
  PipeTransform,
} from '@nestjs/common';
import { DomainError, ERROR_MESSAGES, ERROR_STATUS, type ApiFailure, type ErrorCode, type PageMeta, type ValidationDetails } from '@zemp/shared';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';
import { z } from 'zod';

/**
 * Every response leaves as `{ success, data, meta? }` and every failure as
 * `{ success: false, error: { code, message, details?, requestId } }` — the envelope the frontend
 * already consumes (Frontend.md §148). Internal details never cross the boundary.
 */

/** A paginated payload; the interceptor lifts `meta` beside `data`. */
export class Paged<T> {
  constructor(
    readonly items: T[],
    readonly meta: PageMeta,
  ) {}
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): Paged<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return new Paged([...items.slice(start, start + pageSize)], { page, pageSize, total, totalPages });
}

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((payload) =>
        payload instanceof Paged
          ? { success: true, data: payload.items, meta: payload.meta }
          : { success: true, data: payload ?? null },
      ),
    );
  }
}

/** Validation failures carry per-field messages so forms can highlight the offending inputs. */
export class FieldError extends DomainError {
  constructor(
    code: ErrorCode,
    readonly field: string,
    message: string = ERROR_MESSAGES[code],
  ) {
    super(code, message);
  }
}

/** Carries Zod's field errors to the filter without leaking the schema itself. */
export class ZodRequestError extends Error {
  constructor(readonly details: { fieldErrors: Record<string, string[]>; formErrors: string[] }) {
    super('Request validation failed');
  }
}

const isErrorCode = (value: string): value is ErrorCode => value in ERROR_STATUS;

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Api');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId ?? 'unknown';

    const { status, body } = this.describe(exception, requestId);

    // 5xx means we broke something: keep the detail server-side, send the client a safe message.
    if (status >= 500) {
      this.logger.error(
        JSON.stringify({ requestId, method: request.method, path: request.url, message: this.messageOf(exception) }),
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(JSON.stringify({ requestId, method: request.method, path: request.url, code: body.error.code }));
    }
    response.status(status).json(body);
  }

  private messageOf(exception: unknown): string {
    return exception instanceof Error ? exception.message : String(exception);
  }

  private describe(exception: unknown, requestId: string): { status: number; body: ApiFailure } {
    if (exception instanceof FieldError) {
      return {
        status: ERROR_STATUS[exception.code],
        body: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            details: { fieldErrors: { [exception.field]: [exception.message] }, formErrors: [] },
            requestId,
          },
        },
      };
    }

    if (exception instanceof DomainError) {
      // Some domain errors carry per-field detail (e.g. a report date in the future).
      const details = exception.details as ValidationDetails | undefined;
      return {
        status: ERROR_STATUS[exception.code],
        body: {
          success: false,
          error: { code: exception.code, message: exception.message, ...(details ? { details } : {}), requestId },
        },
      };
    }

    if (exception instanceof ZodRequestError) {
      return {
        status: ERROR_STATUS.VALIDATION_ERROR,
        body: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: ERROR_MESSAGES.VALIDATION_ERROR,
            details: exception.details,
            requestId,
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const raw = typeof payload === 'string' ? payload : ((payload as { message?: unknown }).message ?? '');
      const code: ErrorCode =
        typeof raw === 'string' && isErrorCode(raw)
          ? raw
          : status === HttpStatus.NOT_FOUND
            ? 'NOT_FOUND'
            : status === HttpStatus.TOO_MANY_REQUESTS
              ? 'RATE_LIMITED'
              : status === HttpStatus.UNAUTHORIZED
                ? 'UNAUTHENTICATED'
                : status === HttpStatus.FORBIDDEN
                  ? 'FORBIDDEN'
                  // Nest's built-in pipes (e.g. ParseUUIDPipe on a malformed :id) throw a plain
                  // BadRequestException — a validation failure, not a server fault.
                  : status === HttpStatus.BAD_REQUEST
                    ? 'VALIDATION_ERROR'
                    : 'INTERNAL_ERROR';
      return { status, body: { success: false, error: { code, message: ERROR_MESSAGES[code], requestId } } };
    }

    return {
      status: ERROR_STATUS.INTERNAL_ERROR,
      body: { success: false, error: { code: 'INTERNAL_ERROR', message: ERROR_MESSAGES.INTERNAL_ERROR, requestId } },
    };
  }
}

/**
 * Validates a request payload against a shared Zod schema — the same schemas the forms use, so the
 * client and the API can never disagree about what is valid. The API remains authoritative.
 */
export function zodPipe<T extends z.ZodType>(schema: T): PipeTransform<unknown, z.output<T>> {
  return {
    transform(value: unknown): z.output<T> {
      const result = schema.safeParse(value ?? {});
      if (result.success) return result.data;
      const flattened = z.flattenError(result.error);
      const fieldErrors: Record<string, string[]> = {};
      for (const [field, messages] of Object.entries(flattened.fieldErrors)) {
        fieldErrors[field] = (messages as string[] | undefined) ?? [];
      }
      throw new ZodRequestError({ fieldErrors, formErrors: flattened.formErrors });
    },
  };
}
