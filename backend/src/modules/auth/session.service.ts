import { Inject, Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { CONFIG, type AppConfig } from '../../config/env.js';

export const SESSION_COOKIE = 'zemp_session';
export const CSRF_COOKIE = 'zemp_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export interface Session {
  id: string;
  userId: string;
  csrfToken: string;
  createdAt: Date;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
}

/**
 * Sessions live server-side and reach the browser as an opaque, HttpOnly cookie — the token itself
 * is never readable by scripts, so an XSS bug cannot lift it. A second, script-readable cookie
 * carries the CSRF token for the double-submit check (requirements §17).
 *
 * Phase C moves this map into a `sessions` table; the interface stays the same.
 */
@Injectable()
export class SessionService {
  private readonly sessions = new Map<string, Session>();

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  private get ttlMs(): number {
    return this.config.SESSION_TTL_HOURS * 60 * 60 * 1000;
  }

  /**
   * Sweeps expired sessions on the path that grows the map, so it never leaks unbounded in a
   * long-running process — growth stays proportional to concurrently-live sessions, not all-time
   * logins. Cheap: only entries actually past expiry are touched.
   */
  private pruneExpired(now: Date): void {
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(id);
    }
  }

  create(userId: string, context: { ip?: string | null; userAgent?: string | null }, now = new Date()): Session {
    this.pruneExpired(now);
    const session: Session = {
      id: randomBytes(32).toString('base64url'),
      userId,
      csrfToken: randomBytes(32).toString('base64url'),
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.ttlMs),
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  /** Returns the live session, sliding its expiry; an expired one is dropped immediately. */
  get(id: string | undefined, now = new Date()): Session | null {
    if (!id) return null;
    const session = this.sessions.get(id);
    if (!session) return null;
    if (session.expiresAt <= now) {
      this.sessions.delete(id);
      return null;
    }
    session.expiresAt = new Date(now.getTime() + this.ttlMs);
    return session;
  }

  destroy(id: string | undefined): void {
    if (id) this.sessions.delete(id);
  }

  /** Every other session of this user — used after a password change or reset. */
  destroyAllFor(userId: string, except?: string): void {
    for (const [id, session] of this.sessions) {
      if (session.userId === userId && id !== except) this.sessions.delete(id);
    }
  }

  matchesCsrf(session: Session, headerToken: unknown): boolean {
    if (typeof headerToken !== 'string' || headerToken.length !== session.csrfToken.length) return false;
    return timingSafeEqual(Buffer.from(headerToken), Buffer.from(session.csrfToken));
  }

  /**
   * SameSite=Lax blocks the cross-site form posts CSRF relies on, while still allowing the user to
   * follow a link into the app; the double-submit token covers the rest.
   */
  private cookieOptions(maxAgeMs: number, httpOnly: boolean): CookieOptions {
    return { httpOnly, secure: this.config.COOKIE_SECURE, sameSite: 'lax', path: '/', maxAge: maxAgeMs };
  }

  attach(response: Response, session: Session): void {
    const maxAge = session.expiresAt.getTime() - Date.now();
    response.cookie(SESSION_COOKIE, session.id, this.cookieOptions(maxAge, true));
    response.cookie(CSRF_COOKIE, session.csrfToken, this.cookieOptions(maxAge, false));
  }

  clear(response: Response): void {
    response.clearCookie(SESSION_COOKIE, { path: '/' });
    response.clearCookie(CSRF_COOKIE, { path: '/' });
  }
}
