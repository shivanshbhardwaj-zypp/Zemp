/** PHASE A MOCK — authentication. */
import {
  DomainError,
  changePasswordSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
} from '@zemp/shared';
import { addAudit, db, issueResetToken, newToken, sessionUser } from '../db';
import { SESSION_TTL_MS, clearedCookies, get, parse, post, publicPost, sessionCookies } from '../http';

publicPost('/auth/login', ({ req, body, now, setCookie }) => {
  const input = parse(loginSchema, body);
  const store = db();
  const user = store.users.find((u) => u.email === input.email);
  if (!user || store.passwords.get(user.id) !== input.password) {
    addAudit(req, now, null, 'AUTH_LOGIN_FAILED', 'SESSION', null, { email: input.email, reason: 'INVALID_CREDENTIALS' }, 'FAILURE');
    throw new DomainError('INVALID_CREDENTIALS');
  }
  // Inactive status is revealed only after a correct password, so it cannot be used to probe accounts.
  if (!user.isActive) {
    addAudit(req, now, user.id, 'AUTH_LOGIN_FAILED', 'SESSION', null, { email: input.email, reason: 'ACCOUNT_INACTIVE' }, 'FAILURE');
    throw new DomainError('ACCOUNT_INACTIVE');
  }
  const session = { token: newToken(), userId: user.id, csrf: newToken(), expiresAt: now.getTime() + SESSION_TTL_MS };
  store.sessions.set(session.token, session);
  sessionCookies(session).forEach(setCookie);
  user.lastLoginAt = now;
  addAudit(req, now, user.id, 'AUTH_LOGIN', 'SESSION', null);
  return sessionUser(user);
});

post('/auth/logout', ({ req, now, user, session, setCookie }) => {
  db().sessions.delete(session.token);
  clearedCookies.forEach(setCookie);
  addAudit(req, now, user.id, 'AUTH_LOGOUT', 'SESSION', null);
  return null;
});

get('/auth/me', ({ user }) => sessionUser(user));

post('/auth/password/change', ({ req, now, user, session, body }) => {
  const input = parse(changePasswordSchema, body);
  const store = db();
  if (store.passwords.get(user.id) !== input.currentPassword) throw new DomainError('INVALID_CURRENT_PASSWORD');
  store.passwords.set(user.id, input.newPassword);
  for (const [token, other] of store.sessions) {
    if (other.userId === user.id && token !== session.token) store.sessions.delete(token);
  }
  addAudit(req, now, user.id, 'PASSWORD_CHANGED', 'USER', user.id);
  return null;
});

publicPost('/auth/password-reset/request', ({ req, now, body }) => {
  const input = parse(passwordResetRequestSchema, body);
  const user = db().users.find((u) => u.email === input.email && u.isActive);
  if (user) {
    const { token } = issueResetToken(user.id, now);
    addAudit(req, now, null, 'PASSWORD_RESET_REQUESTED', 'USER', user.id, { email: input.email });
    // No email service in V0.1: the link is printed to the development server log only.
    console.info(`[mock api] Password reset link for ${input.email}: /reset-password?token=${token}`);
  }
  return null; // Same response whether or not the account exists.
});

publicPost('/auth/password-reset/confirm', ({ req, now, body }) => {
  const input = parse(passwordResetConfirmSchema, body);
  const store = db();
  const entry = store.resetTokens.get(input.token);
  if (!entry || entry.expiresAt < now.getTime()) throw new DomainError('INVALID_RESET_TOKEN');
  store.resetTokens.delete(input.token);
  store.passwords.set(entry.userId, input.newPassword);
  for (const [token, session] of store.sessions) if (session.userId === entry.userId) store.sessions.delete(token);
  addAudit(req, now, entry.userId, 'PASSWORD_RESET_COMPLETED', 'USER', entry.userId);
  return null;
});
