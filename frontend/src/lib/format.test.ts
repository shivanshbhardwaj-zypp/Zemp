import type { TaskSummary } from '@zemp/shared';
import { describe, expect, it } from 'vitest';
import { deadlineText, formatDayKey, formatPercent, formatRelative, plural } from './format';

const TZ = 'Asia/Kolkata';
const task = (over: Partial<Pick<TaskSummary, 'deadlineState' | 'dueAt' | 'completedAt'>>) =>
  ({ deadlineState: 'UPCOMING', dueAt: '2026-09-18T06:30:00.000Z', completedAt: null, ...over }) as Pick<
    TaskSummary,
    'deadlineState' | 'dueAt' | 'completedAt'
  >;

describe('deadlineText', () => {
  const now = new Date('2026-09-16T06:00:00.000Z');

  it('counts overdue whole days in the organization time zone', () => {
    expect(deadlineText(task({ deadlineState: 'OVERDUE', dueAt: '2026-09-14T06:30:00.000Z' }), TZ, now)).toBe('Overdue by 2 days');
    expect(deadlineText(task({ deadlineState: 'OVERDUE', dueAt: '2026-09-15T06:30:00.000Z' }), TZ, now)).toBe('Overdue by 1 day');
  });

  it('shows the time when a task is overdue earlier the same day', () => {
    expect(deadlineText(task({ deadlineState: 'OVERDUE', dueAt: '2026-09-16T04:30:00.000Z' }), TZ, now)).toBe('Overdue since 10:00 AM');
  });

  it('labels the remaining deadline states', () => {
    expect(deadlineText(task({ deadlineState: 'DUE_TODAY', dueAt: '2026-09-16T12:30:00.000Z' }), TZ, now)).toBe('Due today, 6:00 PM');
    expect(deadlineText(task({ deadlineState: 'DUE_TOMORROW' }), TZ, now)).toBe('Due tomorrow');
    expect(deadlineText(task({}), TZ, now)).toBe('Due Sep 18');
    expect(deadlineText(task({ deadlineState: 'COMPLETED_LATE', completedAt: '2026-09-13T04:00:00.000Z' }), TZ, now)).toBe(
      'Completed Sep 13',
    );
    expect(deadlineText(task({ deadlineState: 'CANCELLED' }), TZ, now)).toBe('Cancelled');
  });
});

describe('formatting helpers', () => {
  it('renders a day key as a calendar day, not an instant', () => {
    expect(formatDayKey('2026-09-16')).toBe('Wed, Sep 16');
  });

  it('formats percentages and counts', () => {
    expect(formatPercent(66.666, 1)).toBe('66.7%');
    expect(formatPercent(50)).toBe('50%');
    expect(plural(1, 'task')).toBe('1 task');
    expect(plural(1200, 'task')).toBe('1,200 tasks');
  });

  it('formats relative time around the current moment', () => {
    const now = Date.parse('2026-09-16T12:00:00.000Z');
    expect(formatRelative('2026-09-16T11:59:40.000Z', now)).toBe('just now');
    expect(formatRelative('2026-09-16T11:30:00.000Z', now)).toBe('30 minutes ago');
    expect(formatRelative('2026-09-15T12:00:00.000Z', now)).toBe('yesterday');
  });
});
