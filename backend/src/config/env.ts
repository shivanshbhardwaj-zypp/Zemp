import { z } from 'zod';

/**
 * Environment is validated once at startup: a missing or malformed value stops the process rather
 * than surfacing as a confusing runtime failure later. Secrets are never logged.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  ORG_TIME_ZONE: z.string().default('Asia/Kolkata'),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(10).max(10_000).default(300),
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(3).max(1_000).default(10),
});

export type AppConfig = z.infer<typeof envSchema> & { isProduction: boolean };

export const CONFIG = Symbol('ZEMP_CONFIG');

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n  ${problems.join('\n  ')}`);
  }
  const config = parsed.data;
  if (config.NODE_ENV === 'production' && !config.COOKIE_SECURE) {
    throw new Error('COOKIE_SECURE must be true in production so session cookies are HTTPS-only.');
  }
  return { ...config, isProduction: config.NODE_ENV === 'production' };
}
