import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  createParamDecorator,
  type CallHandler,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainError, type Permission } from '@zemp/shared';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import type { Observable } from 'rxjs';
import { StoreService, type SeedUser } from '../data/store.service.js';
import { CSRF_HEADER, SESSION_COOKIE, SessionService, type Session } from '../modules/auth/session.service.js';

/** What the guards attach to the request, and what `@CurrentUser()` hands a controller. */
export interface RequestContext extends Request {
  requestId?: string;
  session?: Session;
  user?: SeedUser;
  /** One clock per request, so every timestamp within it agrees. */
  now?: Date;
}

const PUBLIC_KEY = 'zemp:public';
const PERMISSIONS_KEY = 'zemp:permissions';

/** Opens an endpoint to unauthenticated callers (sign-in, password reset, health). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Requires the role to hold every listed permission; scope rules then narrow it further. */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): SeedUser => {
  const request = context.switchToHttp().getRequest<RequestContext>();
  if (!request.user) throw new DomainError('UNAUTHENTICATED');
  return request.user;
});

export const Now = createParamDecorator((_data: unknown, context: ExecutionContext): Date => {
  const request = context.switchToHttp().getRequest<RequestContext>();
  return request.now ?? new Date();
});

export const ClientInfo = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<RequestContext>();
  return { ip: request.ip ?? null, userAgent: request.get('user-agent') ?? null };
});

/** Tags every request with a correlation id and a single timestamp, echoed on the response. */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestContext>();
    request.requestId ??= randomUUID();
    request.now ??= new Date();
    http.getResponse().setHeader('X-Request-Id', request.requestId);
    return next.handle();
  }
}

/**
 * Authentication, CSRF and permissions in one pass, applied globally so a new endpoint is protected
 * by default and must opt out with `@Public()` — the safe direction to forget something in.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly store: StoreService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestContext>();
    const cookies = (request.cookies ?? {}) as Record<string, string | undefined>;
    const session = this.sessions.get(cookies[SESSION_COOKIE], request.now);
    if (!session) throw new DomainError('UNAUTHENTICATED');

    // Every state-changing verb must echo the CSRF cookie in a header a cross-site form cannot set.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (!this.sessions.matchesCsrf(session, request.headers[CSRF_HEADER])) {
        throw new DomainError('CSRF_INVALID');
      }
    }

    const user = this.store.findUser(session.userId);
    if (!user) {
      this.sessions.destroy(session.id);
      throw new DomainError('UNAUTHENTICATED');
    }
    // A deactivated account loses access immediately, without waiting for its session to expire.
    if (!user.isActive) {
      this.sessions.destroyAllFor(user.id);
      throw new DomainError('ACCOUNT_INACTIVE');
    }

    request.session = session;
    request.user = user;

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    for (const permission of required ?? []) this.store.requirePermission(user, permission);
    return true;
  }
}
