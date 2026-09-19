import { Logger } from '@nestjs/common';
import { JWT } from 'google-auth-library';

/**
 * TEMPORARY — until Phase C's real database lands. Render's filesystem/memory reset on every
 * restart, which was wiping any password a user had changed or an admin had reset back to the
 * seeded demo password. This persists just the password hashes in a Google Sheet so they survive
 * a restart. Delete this file and its two call sites in store.service.ts once Phase C ships.
 *
 * Sheet layout: no header row required — column A is the userId, column B is the argon2id hash.
 * Never the plaintext password. Configured via GOOGLE_SERVICE_ACCOUNT_EMAIL,
 * GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY and GOOGLE_SHEET_ID; unset means this quietly no-ops, same as
 * the SMTP fallback, so local dev is unaffected.
 */

const logger = new Logger('GoogleSheetsPasswordStore');
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const RANGE = 'A:B';

let client: JWT | null | undefined;
let warnedNotConfigured = false;

function warnOnceIfUnconfigured(): boolean {
  const configured = Boolean(process.env.GOOGLE_SHEET_ID);
  if (!configured && !warnedNotConfigured) {
    logger.warn('GOOGLE_SHEET_ID is not set — a changed/reset password will not survive a restart. See backend/.env.example.');
    warnedNotConfigured = true;
  }
  return configured;
}

function authClient(): JWT | null {
  if (client !== undefined) return client;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  client = email && key ? new JWT({ email, key: key.replace(/\\n/g, '\n'), scopes: [SCOPE] }) : null;
  return client;
}

async function sheetsFetch(pathAndQuery: string, init?: RequestInit): Promise<Response> {
  const auth = authClient();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!auth || !sheetId) throw new Error('Google Sheets not configured');
  const { token } = await auth.getAccessToken();
  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${pathAndQuery}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

/** All password overrides currently in the sheet, keyed by userId. Empty if not configured. */
export async function loadPasswordOverrides(): Promise<Map<string, string>> {
  const overrides = new Map<string, string>();
  if (!warnOnceIfUnconfigured()) return overrides;
  try {
    const res = await sheetsFetch(RANGE);
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const body = (await res.json()) as { values?: string[][] };
    for (const [userId, hash] of body.values ?? []) {
      if (userId && hash) overrides.set(userId, hash);
    }
    logger.log(`Loaded ${overrides.size} password override(s) from Google Sheets.`);
  } catch (error) {
    logger.error(`Failed to load password overrides: ${(error as Error).message}`);
  }
  return overrides;
}

/**
 * Upserts one user's row. Fire-and-forget from the caller — logs on failure, never throws, so a
 * Sheets outage never blocks the password change itself (which already took effect in memory).
 *
 * ponytail: read-then-write with no locking — a real race if two passwords change in the same
 * instant, acceptable for this org's size while it's temporary. Phase C's DB gets a real
 * transaction; this doesn't need one to outlive its purpose.
 */
export async function savePasswordOverride(userId: string, hash: string): Promise<void> {
  if (!warnOnceIfUnconfigured()) return;
  try {
    const existing = await sheetsFetch(RANGE);
    if (!existing.ok) throw new Error(`${existing.status} ${await existing.text()}`);
    const body = (await existing.json()) as { values?: string[][] };
    const rows = body.values ?? [];
    const rowNumber = rows.findIndex((r) => r[0] === userId) + 1 || rows.length + 1;
    const range = `A${rowNumber}:B${rowNumber}`;
    const res = await sheetsFetch(`${range}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ range, values: [[userId, hash]] }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  } catch (error) {
    logger.error(`Failed to save password override for ${userId}: ${(error as Error).message}`);
  }
}
