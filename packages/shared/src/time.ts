/**
 * Organization-timezone calendar helpers. Timestamps are stored in UTC; "today", "due tomorrow"
 * and daily report buckets are evaluated in the organization's IANA time zone (requirements §32).
 */
export const DAY_MS = 86_400_000;

const KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(date: Date, timeZone: string): WallClock {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return parts as unknown as WallClock;
}

const pad = (n: number) => String(n).padStart(2, '0');

function parseKey(key: string): [number, number, number] {
  const m = KEY_PATTERN.exec(key);
  if (!m) throw new RangeError(`Invalid date key: ${key}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Wall-clock offset of `timeZone` from UTC at `date`, in milliseconds. */
function offsetMs(date: Date, timeZone: string): number {
  const w = wallClock(date, timeZone);
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return wallAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Calendar day of `date` in `timeZone`, as `YYYY-MM-DD`. */
export function dayKey(date: Date, timeZone: string): string {
  const w = wallClock(date, timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** The UTC instant of wall-clock `time` (`HH:mm`) on day `key` in `timeZone`. DST-safe. */
export function zonedTimeToUtc(key: string, time: string, timeZone: string): Date {
  const [y, m, d] = parseKey(key);
  const t = TIME_PATTERN.exec(time);
  if (!t) throw new RangeError(`Invalid time: ${time}`);
  const guess = Date.UTC(y, m - 1, d, Number(t[1]), Number(t[2]));
  const first = guess - offsetMs(new Date(guess), timeZone);
  const second = guess - offsetMs(new Date(first), timeZone);
  return new Date(second);
}

/** Start of day `key` in `timeZone`, as a UTC instant. */
export function startOfDay(key: string, timeZone: string): Date {
  return zonedTimeToUtc(key, '00:00', timeZone);
}

/** `YYYY-MM-DDTHH:mm` for a `datetime-local` input, rendered in `timeZone`. */
export function toDateTimeInput(date: Date, timeZone: string): string {
  const w = wallClock(date, timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/** Parses a `datetime-local` value as wall-clock time in `timeZone`. */
export function fromDateTimeInput(value: string, timeZone: string): Date {
  const [key, time] = value.split('T');
  if (!key || !time) throw new RangeError(`Invalid date-time: ${value}`);
  return zonedTimeToUtc(key, time.slice(0, 5), timeZone);
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Whole calendar days from `fromKey` to `toKey` (negative when `toKey` is earlier). */
export function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = parseKey(fromKey);
  const [ty, tm, td] = parseKey(toKey);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

/** Inclusive list of day keys from `fromKey` to `toKey`. */
export function dayRange(fromKey: string, toKey: string): string[] {
  const count = daysBetween(fromKey, toKey);
  return Array.from({ length: Math.max(count + 1, 0) }, (_, i) => addDays(fromKey, i));
}
