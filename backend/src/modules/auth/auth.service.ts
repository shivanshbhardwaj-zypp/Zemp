import { Injectable, Logger } from '@nestjs/common';
import {
  DomainError,
  type ChangePasswordInput,
  type LoginInput,
  type PasswordResetConfirmInput,
  type PasswordResetRequestInput,
  type SessionUser,
} from '@zemp/shared';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../data/prisma.service.js';
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
  private decoyHashPromise: Promise<string> | null = null;

  constructor(
    private readonly store: StoreService,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
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
      await this.store.addAudit({
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
      await this.store.addAudit({
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

    const session = await this.sessions.create(user.id, client, now);
    user.lastLoginAt = now;
    await this.store.saveUser(user);
    await this.store.addAudit({
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

  async logout(user: SeedUser, session: Session, client: ClientContext, now: Date): Promise<void> {
    await this.sessions.destroy(session.id);
    await this.store.addAudit({
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
    await this.store.setPasswordHash(user.id, await hashPassword(input.newPassword));
    await this.sessions.destroyAllFor(user.id, session.id);
    await this.store.addAudit({
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
  async requestPasswordReset(input: PasswordResetRequestInput, client: ClientContext, now: Date): Promise<void> {
    const user = this.store.findUserByEmail(input.email);
    if (!user?.isActive) return;
    const token = await this.issueResetToken(user.id, now);
    await this.store.addAudit({
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

  async issueResetToken(userId: string, now: Date): Promise<string> {
    // Sweep expired tokens on the path that grows the table, so it never accumulates unboundedly.
    await this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } });
    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: { token, userId, expiresAt: new Date(now.getTime() + RESET_TTL_MS) },
    });
    return token;
  }

  /** Single-use: the token is consumed before the new password is stored. */
  async confirmPasswordReset(input: PasswordResetConfirmInput, client: ClientContext, now: Date): Promise<void> {
    const entry = await this.prisma.passwordResetToken.findUnique({ where: { token: input.token } });
    if (!entry || entry.expiresAt < now) throw new DomainError('INVALID_RESET_TOKEN');
    await this.prisma.passwordResetToken.delete({ where: { token: input.token } }).catch(() => undefined);
    await this.store.setPasswordHash(entry.userId, await hashPassword(input.newPassword));
    await this.sessions.destroyAllFor(entry.userId);
    await this.store.addAudit({
      actorId: entry.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      resourceType: 'USER',
      resourceId: entry.userId,
      at: now,
      ...client,
    });
  }
}
