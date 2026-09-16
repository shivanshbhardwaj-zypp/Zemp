/** PHASE A MOCK — minimal router producing the real API envelope, auth, CSRF and error behaviour. */
import {
  DomainError,
  ERROR_MESSAGES,
  ROLE_PERMISSIONS,
  type ErrorCode,
  type PageMeta,
  type Permission,
} from '@zemp/shared';
import type { SeedUser } from '@zemp/shared/seed';
import { z } from 'zod';
import { db, type MockSession } from './db';

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface BaseContext {
  req: Request;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  now: Date;
  setCookie: (cookie: string) => void;
}

export interface Context extends BaseContext {
  user: SeedUser;
  session: MockSession;
}

export interface PublicContext extends BaseContext {
  user: SeedUser | null;
  session: MockSession | null;
}

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  isPublic: boolean;
  handler: (ctx: PublicContext) => unknown;
}

// Keyed so hot reloads replace handlers instead of stacking duplicates.
const routes = new Map<string, Route>();

function register(method: string, path: string, handler: (ctx: never) => unknown, isPublic: boolean) {
  const keys: string[] = [];
  const pattern = new RegExp(
    `^${path.replace(/:(\w+)/g, (_, key: string) => {
      keys.push(key);
      return '([^/]+)';
    })}$`,
  );
  routes.set(`${method} ${path}`, { method, pattern, keys, isPublic, handler: handler as Route['handler'] });
}

export const get = (path: string, handler: (ctx: Context) => unknown) => register('GET', path, handler, false);
export const post = (path: string, handler: (ctx: Context) => unknown) => register('POST', path, handler, false);
export const patch = (path: string, handler: (ctx: Context) => unknown) => register('PATCH', path, handler, false);
export const publicPost = (path: string, handler: (ctx: PublicContext) => unknown) =>
  register('POST', path, handler, true);

export class Paged<T> {
  constructor(
    readonly items: T[],
    readonly meta: PageMeta,
  ) {}
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): Paged<T> {
  const total = items.length;
  return new Paged(items.slice((page - 1) * pageSize, page * pageSize), {
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
  });
}

export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new DomainError('VALIDATION_ERROR', ERROR_MESSAGES.VALIDATION_ERROR, z.flattenError(result.error));
  }
  return result.data;
}

export function requirePermission(user: SeedUser, permission: Permission) {
  if (!ROLE_PERMISSIONS[user.role].includes(permission)) throw new DomainError('FORBIDDEN');
}

export const fieldError = (code: ErrorCode, field: string, message: string = ERROR_MESSAGES[code]) =>
  new DomainError(code, message, { fieldErrors: { [field]: [message] }, formErrors: [] });

export const sessionCookies = (session: MockSession) => [
  `zemp_session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`,
  `zemp_csrf=${session.csrf}; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`,
];

export const clearedCookies = [
  'zemp_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  'zemp_csrf=; Path=/; SameSite=Lax; Max-Age=0',
];

function respond(body: unknown, status: number, cookies: string[]) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

const readCookie = (req: Request, name: string) =>
  req.headers
    .get('cookie')
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);

export async function handle(req: Request, segments: string[]): Promise<Response> {
  // A little latency so loading states are exercised during development.
  await new Promise((resolve) => setTimeout(resolve, 120 + Math.random() * 180));
  const cookies: string[] = [];
  try {
    const path = `/${segments.map(encodeURIComponent).join('/')}`;
    const candidates = [...routes.values()].filter((r) => r.pattern.test(path));
    const route = candidates.find((r) => r.method === req.method);
    if (!route) throw new DomainError('NOT_FOUND', candidates.length ? 'This action is not supported.' : 'This endpoint does not exist.');

    const now = new Date();
    const store = db();
    const token = readCookie(req, 'zemp_session');
    let session = token ? (store.sessions.get(token) ?? null) : null;
    const expired = !!session && session.expiresAt < now.getTime();
    if (expired && session) {
      store.sessions.delete(session.token);
      session = null;
    }
    const user = session ? (store.users.find((u) => u.id === session.userId && u.isActive) ?? null) : null;

    if (!route.isPublic) {
      if (!session || !user) {
        cookies.push(...clearedCookies);
        throw new DomainError(expired ? 'SESSION_EXPIRED' : 'UNAUTHENTICATED');
      }
      if (req.method !== 'GET' && req.headers.get('x-csrf-token') !== session.csrf) {
        throw new DomainError('CSRF_INVALID');
      }
      session.expiresAt = now.getTime() + SESSION_TTL_MS;
    }

    const match = route.pattern.exec(path)!;
    const params = Object.fromEntries(route.keys.map((key, i) => [key, decodeURIComponent(match[i + 1]!)]));
    const body = req.method === 'GET' ? undefined : await req.json().catch(() => ({}));
    const result = await route.handler({
      req,
      params,
      query: Object.fromEntries(new URL(req.url).searchParams),
      body,
      now,
      user,
      session,
      setCookie: (cookie) => cookies.push(cookie),
    });
    return result instanceof Paged
      ? respond({ success: true, data: result.items, meta: result.meta }, 200, cookies)
      : respond({ success: true, data: result ?? null }, 200, cookies);
  } catch (error) {
    if (error instanceof DomainError) {
      const details = error.details ? { details: error.details } : {};
      return respond({ success: false, error: { code: error.code, message: error.message, ...details } }, error.status, cookies);
    }
    console.error('[mock api]', error);
    return respond({ success: false, error: { code: 'INTERNAL_ERROR', message: ERROR_MESSAGES.INTERNAL_ERROR } }, 500, cookies);
  }
}
