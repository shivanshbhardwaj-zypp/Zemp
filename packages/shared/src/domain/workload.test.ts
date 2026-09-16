import { describe, expect, it } from 'vitest';
import {
  completionRate,
  isInWorkload,
  summarizeWorkload,
  workloadRisk,
  type WorkloadTask,
} from './workload.js';

const TZ = 'Asia/Kolkata';
const assigned = new Date('2026-09-10T03:30:00Z'); // 09:00 IST
const deadline = new Date('2026-09-15T12:30:00Z'); // 18:00 IST, five days later

function batch(completed: number, completedAt: Date, total = 30): WorkloadTask[] {
  return Array.from({ length: total }, (_, i) => ({
    status: i < completed ? 'COMPLETED' : 'IN_PROGRESS',
    progress: i < completed ? 100 : 30,
    startAt: assigned,
    createdAt: assigned,
    dueAt: deadline,
    completedAt: i < completed ? completedAt : null,
    origin: 'ASSIGNED',
    reviewStatus: null,
  }));
}

describe('requirements §10 — 30 tasks × 3 employees, 5-day deadline', () => {
  const day1 = new Date('2026-09-11T03:30:00Z');
  const day3 = new Date('2026-09-13T03:30:00Z');

  it('derives completion, remaining work and team totals from task data', () => {
    const a = summarizeWorkload(batch(4, day1), day1, TZ);
    const b = summarizeWorkload(batch(2, day1), day1, TZ);
    const c = summarizeWorkload(batch(0, day1), day1, TZ);
    expect([a.completionRate, a.remaining]).toEqual([13.33, 26]);
    expect([b.completionRate, b.remaining]).toEqual([6.67, 28]);
    expect([c.completionRate, c.remaining]).toEqual([0, 30]);

    const team = summarizeWorkload([...batch(4, day1), ...batch(2, day1), ...batch(0, day1)], day1, TZ);
    expect(team).toMatchObject({ total: 90, completed: 6, remaining: 84, completionRate: 6.67 });
  });

  it('compares the required daily rate with the pace achieved so far', () => {
    expect(workloadRisk(batch(4, day1), day1, TZ)).toBe('AT_RISK'); // needs ~5.9/day, did 4/day
    expect(workloadRisk(batch(18, day3), day3, TZ)).toBe('ON_TRACK'); // needs ~5.1/day, doing 6/day
    expect(workloadRisk(batch(9, day3), day3, TZ)).toBe('AT_RISK');
  });

  it('reports finished and overdue workloads explicitly', () => {
    const afterDeadline = new Date('2026-09-15T13:00:00Z');
    expect(workloadRisk(batch(30, afterDeadline), afterDeadline, TZ)).toBe('COMPLETED');
    expect(workloadRisk(batch(29, afterDeadline), afterDeadline, TZ)).toBe('OVERDUE');
  });
});

describe('self-reported work in metrics', () => {
  const now = new Date('2026-09-14T06:30:00Z');
  const logged = (reviewStatus: WorkloadTask['reviewStatus']): WorkloadTask => ({
    status: 'COMPLETED',
    progress: 100,
    startAt: null,
    createdAt: now,
    dueAt: now,
    completedAt: now,
    origin: 'SELF_REPORTED',
    reviewStatus,
  });
  const assignedOpen: WorkloadTask = {
    status: 'IN_PROGRESS',
    progress: 20,
    startAt: assigned,
    createdAt: assigned,
    dueAt: deadline,
    completedAt: null,
    origin: 'ASSIGNED',
    reviewStatus: null,
  };

  it('counts a submission only once it is approved', () => {
    expect(summarizeWorkload([assignedOpen, logged('PENDING')], now, TZ)).toMatchObject({ total: 1, completed: 0 });
    expect(summarizeWorkload([assignedOpen, logged('CHANGES_REQUESTED')], now, TZ)).toMatchObject({ total: 1, completed: 0 });
    expect(summarizeWorkload([assignedOpen, logged('APPROVED')], now, TZ)).toMatchObject({ total: 2, completed: 1 });
  });

  it('keeps an unapproved submission out of completion rate entirely', () => {
    expect(summarizeWorkload([logged('PENDING')], now, TZ).completionRate).toBe(0);
    expect(summarizeWorkload([logged('APPROVED')], now, TZ).completionRate).toBe(100);
  });
});

describe('active workload', () => {
  it('drops completed work once its deadline has passed but keeps open overdue work', () => {
    const now = new Date('2026-09-20T06:30:00Z');
    const dayStart = new Date('2026-09-19T18:30:00Z'); // midnight IST
    const done: WorkloadTask = {
      status: 'COMPLETED',
      progress: 100,
      startAt: null,
      createdAt: assigned,
      dueAt: deadline,
      completedAt: deadline,
      origin: 'ASSIGNED',
      reviewStatus: null,
    };
    const stillOpen: WorkloadTask = { ...done, status: 'IN_PROGRESS', progress: 60, completedAt: null };

    expect(isInWorkload(done, dayStart)).toBe(false);
    expect(isInWorkload(stillOpen, dayStart)).toBe(true);
    expect(isInWorkload({ ...stillOpen, status: 'CANCELLED', dueAt: now }, dayStart)).toBe(false);
    expect(summarizeWorkload([done, stillOpen], now, TZ)).toMatchObject({
      total: 1,
      overdue: 1,
      completionRate: 0,
    });
  });

  it('never divides by zero', () => {
    expect(completionRate(0, 0)).toBe(0);
    expect(workloadRisk([], new Date(), TZ)).toBeNull();
  });
});
