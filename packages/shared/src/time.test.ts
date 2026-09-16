import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayKey,
  dayRange,
  daysBetween,
  fromDateTimeInput,
  isValidTimeZone,
  startOfDay,
  toDateTimeInput,
  zonedTimeToUtc,
} from './time.js';

describe('organization time zone helpers', () => {
  it('buckets instants into organization-local days', () => {
    expect(dayKey(new Date('2026-09-14T18:29:59Z'), 'Asia/Kolkata')).toBe('2026-09-14');
    expect(dayKey(new Date('2026-09-14T18:30:00Z'), 'Asia/Kolkata')).toBe('2026-09-15');
  });

  it('converts wall-clock times to UTC, including across DST changes', () => {
    expect(startOfDay('2026-09-15', 'Asia/Kolkata').toISOString()).toBe('2026-09-14T18:30:00.000Z');
    // New York is UTC−4 until 1 Nov 2026 and UTC−5 afterwards; DST starts 8 Mar 2026.
    expect(zonedTimeToUtc('2026-10-31', '09:00', 'America/New_York').toISOString()).toBe('2026-10-31T13:00:00.000Z');
    expect(zonedTimeToUtc('2026-11-02', '09:00', 'America/New_York').toISOString()).toBe('2026-11-02T14:00:00.000Z');
    expect(startOfDay('2026-03-08', 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z');
  });

  it('round-trips datetime-local input values', () => {
    const due = fromDateTimeInput('2026-09-18T18:00', 'Asia/Kolkata');
    expect(due.toISOString()).toBe('2026-09-18T12:30:00.000Z');
    expect(toDateTimeInput(due, 'Asia/Kolkata')).toBe('2026-09-18T18:00');
  });

  it('does calendar arithmetic on day keys', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-09-14', '2026-09-10')).toBe(-4);
    expect(dayRange('2026-09-10', '2026-09-12')).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
