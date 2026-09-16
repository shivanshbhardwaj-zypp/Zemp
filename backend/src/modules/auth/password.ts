import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Argon2id password hashing on Node's built-in primitive — no native dependency to compile or keep
 * patched. Parameters follow the OWASP Password Storage Cheat Sheet's second recommended profile
 * (19 MiB, 2 passes, 1 lane); raising `MEMORY_KIB` costs an attacker far more than it costs us.
 */
const ALGORITHM = 'argon2id';
const MEMORY_KIB = 19_456;
const PASSES = 2;
const PARALLELISM = 1;
const TAG_LENGTH = 32;
const NONCE_LENGTH = 16;

const argon2Async = promisify(argon2) as (
  algorithm: string,
  options: {
    message: Buffer;
    nonce: Buffer;
    parallelism: number;
    tagLength: number;
    memory: number;
    passes: number;
  },
) => Promise<Buffer>;

const derive = (password: string, nonce: Buffer, tagLength = TAG_LENGTH, memory = MEMORY_KIB, passes = PASSES, parallelism = PARALLELISM): Promise<Buffer> =>
  argon2Async(ALGORITHM, { message: Buffer.from(password, 'utf8'), nonce, parallelism, tagLength, memory, passes });

/** Encoded as `$argon2id$m=..,t=..,p=..$<salt>$<hash>` so parameters can be raised without a reset. */
export async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(NONCE_LENGTH);
  const tag = await derive(password, nonce);
  return `$${ALGORITHM}$m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM}$${nonce.toString('base64url')}$${tag.toString('base64url')}`;
}

/** Constant-time comparison; a malformed or missing hash simply fails to verify. */
export async function verifyPassword(password: string, encoded: string | undefined): Promise<boolean> {
  if (!encoded) return false;
  const parts = encoded.split('$');
  if (parts.length !== 5 || parts[1] !== ALGORITHM) return false;
  const [, , params, saltPart, hashPart] = parts as [string, string, string, string, string];
  const memory = Number(/m=(\d+)/.exec(params)?.[1]);
  const passes = Number(/t=(\d+)/.exec(params)?.[1]);
  const parallelism = Number(/p=(\d+)/.exec(params)?.[1]);
  if (!memory || !passes || !parallelism) return false;

  const expected = Buffer.from(hashPart, 'base64url');
  const actual = await derive(password, Buffer.from(saltPart, 'base64url'), expected.length, memory, passes, parallelism);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
