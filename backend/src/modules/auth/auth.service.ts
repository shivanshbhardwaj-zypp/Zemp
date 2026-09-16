import { Injectable, Logger } from '@nestjs/common';
import {
  DomainError,
  type ChangePasswordInput,
  type LoginInput,
  type PasswordResetConfirmInput,
  type PasswordResetRequestInput,
  type SessionUser,
} from '@zemp/shared';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { StoreService, type SeedUser } from '../../data/store.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { SessionService, type Session } from './session.service.js';

/** A reset link is short-lived and single-use (requirements §17). */
const RESET_TTL_MS = 30 * 60 * 1000;

export interface ClientContext {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** token → { userId, expiresAt }. Phase C moves this to a `password_reset_tokens` table. */
  private readonly resetTokens = new Map<string, { userId: string; expiresAt: number }>();
  private decoyHashPromise: Promise<string> | null = null;

  constructor(
    private readonly store: StoreService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * Sign-in. A wrong email and a wrong password fail identically, and both spend the same argon2
   * work, so response timing cannot be used to enumerate accounts. Every attempt is audited.
   */
  async login(input: LoginInput, client: ClientContext, now: Date): Promise<{ user: SessionUser; session: Session }> {
    const user = this.store.findUserByEmail(input.email);
    const hash = user ? this.store.passwordHash(user.id) : undefined;
    const matches = await verifyPassword(input.password, hash ?? (await this.decoyHash()));

    if (!user || !matches) {
      this.store.addAudit({
        actorId: user?.id ?? null,
        action: 'AUTH_LOGIN_FAILED',
        resourceType: 'SESSION',
        resourceId: null,
        at: now,
        metadata: { email: input.email, reason: 'INVALID_CREDENTIALS' },
        result: 'FAILURE',
        ...client,
      });
      throw new DomainError('INVALID_CREDENTIALS');
    }

    // Inactive status is revealed only after a correct password, so it cannot be used to probe.
    if (!user.isActive) {
      this.store.addAudit({
        actorId: user.id,
        action: 'AUTH_LOGIN_FAILED',
        resourceType: 'SESSION',
        resourceId: null,
        at: now,
        metadata: { email: input.email, reason: 'ACCOUNT_INACTIVE' },
        result: 'FAILURE',
        ...client,
      });
      throw new DomainError('ACCOUNT_INACTIVE');
    }

    const session = this.sessions.create(user.id, client, now);
    user.lastLoginAt = now;
    this.store.addAudit({
      actorId: user.id,
      action: 'AUTH_LOGIN',
      resourceType: 'SESSION',
      resourceId: null,
      at: now,
      ...client,
    });
    return { user: this.store.sessionUser(user), session };
  }

  /** Keeps the failure path as expensive as the success path. */
  private decoyHash(): Promise<string> {
    this.decoyHashPromise ??= hashPassword(randomBytes(24).toString('base64url'));
    return this.decoyHashPromise;
  }

  logout(user: SeedUser, session: Session, client: ClientContext, now: Date): void {
    this.sessions.destroy(session.id);
    this.store.addAudit({
      actorId: user.id,
      action: 'AUTH_LOGOUT',
      resourceType: 'SESSION',
      resourceId: null,
      at: now,
      ...client,
    });
  }

  me(user: SeedUser): SessionUser {
    return this.store.sessionUser(user);
  }

  /** Changing a password signs out every other session, so a stolen one dies with the change. */
  async changePassword(
    user: SeedUser,
    session: Session,
    input: ChangePasswordInput,
    client: ClientContext,
    now: Date,
  ): Promise<void> {
    const current = await verifyPassword(input.currentPassword, this.store.passwordHash(user.id));
    if (!current) throw new DomainError('INVALID_CURRENT_PASSWORD');
    this.store.setPasswordHash(user.id, await hashPassword(input.newPassword));
    this.sessions.destroyAllFor(user.id, session.id);
    this.store.addAudit({
      actorId: user.id,
      action: 'PASSWORD_CHANGED',
      resourceType: 'USER',
      resourceId: user.id,
      at: now,
      ...client,
    });
  }

  /**
   * Always returns the same response whether or not the address exists — an attacker learns nothing
   * about who has an account. V0.1 has no mail service, so the link goes to the server log only.
   */
  requestPasswordReset(input: PasswordResetRequestInput, client: ClientContext, now: Date): void {
    const user = this.store.findUserByEmail(input.email);
    if (!user?.isActive) return;
    const token = this.issueResetToken(user.id, now);
    this.store.addAudit({
      actorId: null,
      action: 'PASSWORD_RESET_REQUESTED',
      resourceType: 'USER',
      resourceId: user.id,
      at: now,
      metadata: { email: input.email },
      ...client,
    });
    this.logger.log(`Password reset link for ${input.email}: /reset-password?token=${token}`);
  }

  issueResetToken(userId: string, now: Date): string {
    const token = randomBytes(32).toString('base64url');
    this.resetTokens.set(token, { userId, expiresAt: now.getTime() + RESET_TTL_MS });
    return token;
  }

  /** Single-use: the token is consumed before the new password is stored. */
  async confirmPasswordReset(input: PasswordResetConfirmInput, client: ClientContext, now: Date): Promise<void> {
    const entry = this.findResetToken(input.token);
    if (!entry || entry.expiresAt < now.getTime()) throw new DomainError('INVALID_RESET_TOKEN');
    this.resetTokens.delete(entry.token);
    this.store.setPasswordHash(entry.userId, await hashPassword(input.newPassword));
    this.sessions.destroyAllFor(entry.userId);
    this.store.addAudit({
      actorId: entry.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      resourceType: 'USER',
      resourceId: entry.userId,
      at: now,
      ...client,
    });
  }

  /** Compared in constant time so a token cannot be guessed character by character. */
  private findResetToken(candidate: string): { token: string; userId: string; expiresAt: number } | null {
    const candidateBuffer = Buffer.from(candidate);
    for (const [token, entry] of this.resetTokens) {
      const known = Buffer.from(token);
      if (known.length === candidateBuffer.length && timingSafeEqual(known, candidateBuffer)) {
        return { token, ...entry };
      }
    }
    return null;
  }
}
