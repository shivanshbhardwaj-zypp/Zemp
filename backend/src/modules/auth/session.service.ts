import { Inject, Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { CONFIG, type AppConfig } from '../../config/env.js';
import { PrismaService } from '../../data/prisma.service.js';

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
 * Sessions live in Postgres and reach the browser as an opaque, HttpOnly cookie — the token itself
 * is never readable by scripts, so an XSS bug cannot lift it. A second, script-readable cookie
 * carries the CSRF token for the double-submit check (requirements §17). Backed by a table (not
 * memory) so a session survives a server restart instead of forcing everyone to sign in again.
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  private get ttlMs(): number {
    return this.config.SESSION_TTL_HOURS * 60 * 60 * 1000;
  }

  async create(userId: string, context: { ip?: string | null; userAgent?: string | null }, now = new Date()): Promise<Session> {
    const session: Session = {
      id: randomBytes(32).toString('base64url'),
      userId,
      csrfToken: randomBytes(32).toString('base64url'),
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.ttlMs),
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    };
    await this.prisma.session.create({ data: session });
    return session;
  }

  /** Returns the live session, sliding its expiry; an expired one is dropped immediately. */
  async get(id: string | undefined, now = new Date()): Promise<Session | null> {
    if (!id) return null;
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) return null;
    if (session.expiresAt <= now) {
      await this.prisma.session.delete({ where: { id } }).catch(() => undefined);
      return null;
    }
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    await this.prisma.session.update({ where: { id }, data: { expiresAt } });
    return { ...session, expiresAt };
  }

  async destroy(id: string | undefined): Promise<void> {
    if (!id) return;
    await this.prisma.session.delete({ where: { id } }).catch(() => undefined);
  }

  /** Every other session of this user — used after a password change or reset. */
  async destroyAllFor(userId: string, except?: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId, ...(except ? { id: { not: except } } : {}) } });
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
