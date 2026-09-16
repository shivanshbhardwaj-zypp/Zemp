import { dayKey, daysBetween, type TaskSummary } from '@zemp/shared';

/**
 * Presentation formatting in the organization time zone (Frontend.md §108–109). These only format
 * values the API already decided — deadline state, overdue and risk come from the backend.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, ...options });
    formatters.set(key, f);
  }
  return f;
}

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

/** Sep 14, 2026 */
export const formatDate = (value: string | Date, timeZone: string) =>
  formatter(timeZone, { dateStyle: 'medium' }).format(toDate(value));

/** Sep 14 */
export const formatShortDate = (value: string | Date, timeZone: string) =>
  formatter(timeZone, { month: 'short', day: 'numeric' }).format(toDate(value));

/** Sep 14, 2026, 10:32 AM */
export const formatDateTime = (value: string | Date, timeZone: string) =>
  formatter(timeZone, { dateStyle: 'medium', timeStyle: 'short' }).format(toDate(value));

/** 10:32 AM */
export const formatTime = (value: string | Date, timeZone: string) =>
  formatter(timeZone, { timeStyle: 'short' }).format(toDate(value));

/** Mon, Sep 14 — for day keys (YYYY-MM-DD), which are calendar days rather than instants. */
export const formatDayKey = (key: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  formatter('UTC', options).format(new Date(`${key}T12:00:00Z`));

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** 10 minutes ago */
export function formatRelative(value: string | Date, now: number = Date.now()) {
  const seconds = (toDate(value).getTime() - now) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  if (abs < 3_600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3_600), 'hour');
  if (abs < 604_800) return relative.format(Math.round(seconds / 86_400), 'day');
  if (abs < 2_629_800) return relative.format(Math.round(seconds / 604_800), 'week');
  return relative.format(Math.round(seconds / 2_629_800), 'month');
}

/** Due today · Due tomorrow · Due Sep 18 · Overdue by 2 days · Completed Sep 13 (Frontend.md §109). */
export function deadlineText(
  task: Pick<TaskSummary, 'deadlineState' | 'dueAt' | 'completedAt'>,
  timeZone: string,
  now: Date = new Date(),
): string {
  switch (task.deadlineState) {
    case 'OVERDUE': {
      const days = daysBetween(dayKey(new Date(task.dueAt), timeZone), dayKey(now, timeZone));
      return days <= 0 ? `Overdue since ${formatTime(task.dueAt, timeZone)}` : `Overdue by ${days} day${days === 1 ? '' : 's'}`;
    }
    case 'DUE_TODAY':
      return `Due today, ${formatTime(task.dueAt, timeZone)}`;
    case 'DUE_TOMORROW':
      return 'Due tomorrow';
    case 'UPCOMING':
      return `Due ${formatShortDate(task.dueAt, timeZone)}`;
    case 'COMPLETED_ON_TIME':
    case 'COMPLETED_LATE':
      return task.completedAt ? `Completed ${formatShortDate(task.completedAt, timeZone)}` : 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
  }
}

const counts = new Intl.NumberFormat('en-US');
export const formatCount = (n: number) => counts.format(n);

export const formatPercent = (n: number, digits = 0) => `${n.toFixed(digits)}%`;

export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
