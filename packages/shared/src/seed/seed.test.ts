import { describe, expect, it } from 'vitest';
import { summarizeWorkload } from '../domain/workload.js';
import { DEMO_PASSWORD, generateSeed } from './index.js';

const TZ = 'Asia/Kolkata';
const now = new Date('2026-09-15T06:30:00Z'); // 12:00 IST
const seed = generateSeed({ now, timeZone: TZ });
const person = (name: string) => seed.users.find((u) => u.name === name)!;

describe('demo seed', () => {
  it('builds the hierarchy from requirements §36', () => {
    const count = (role: string) => seed.users.filter((u) => u.role === role).length;
    expect([count('SUPER_ADMIN'), count('ADMIN'), count('EMPLOYEE')]).toEqual([1, 3, 30]);
    for (const team of seed.teams.filter((t) => t.ownerId)) {
      expect(seed.memberships.filter((m) => m.teamId === team.id && !m.leftAt)).toHaveLength(10);
    }
    expect(new Set(seed.users.map((u) => u.email)).size).toBe(seed.users.length);
    expect(new Set(seed.users.map((u) => u.employeeCode)).size).toBe(seed.users.length);
    expect(DEMO_PASSWORD.length).toBeGreaterThanOrEqual(10);
  });

  it('is deterministic for a given moment', () => {
    const again = generateSeed({ now, timeZone: TZ });
    const shape = (s: typeof seed) => s.tasks.map((t) => [t.id, t.status, t.progress, t.dueAt.getTime()]);
    expect(shape(again)).toEqual(shape(seed));
  });

  it('replays the 30-task sprint from requirements §10', () => {
    const aarav = person('Aarav Shah');
    const sprint = seed.tasks.filter((t) => t.assigneeId === aarav.id && t.title.startsWith('Regression'));
    expect(sprint).toHaveLength(30);
    // Completed before midnight IST (18:30 UTC) at the end of sprint days 1, 2 and 3.
    const doneBy = (utcMidnightIst: string) =>
      sprint.filter((t) => t.completedAt && t.completedAt < new Date(utcMidnightIst)).length;
    expect([
      doneBy('2026-09-12T18:30:00Z'),
      doneBy('2026-09-13T18:30:00Z'),
      doneBy('2026-09-14T18:30:00Z'),
    ]).toEqual([4, 10, 18]);
  });

  it('never records history in the future or before its task existed', () => {
    const createdAt = new Map(seed.tasks.map((t) => [t.id, t.createdAt.getTime()]));
    for (const event of seed.activities) {
      expect(event.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(event.createdAt.getTime()).toBeGreaterThanOrEqual(createdAt.get(event.taskId)!);
    }
    for (const task of seed.tasks.filter((t) => t.status === 'COMPLETED')) {
      expect(task.progress).toBe(100);
      expect(task.completedAt).not.toBeNull();
    }
  });

  it("stores today's snapshot in agreement with the live workload", () => {
    const aarav = person('Aarav Shah');
    const snapshot = seed.snapshots.find((s) => s.userId === aarav.id && s.date === '2026-09-15')!;
    const live = summarizeWorkload(seed.tasks.filter((t) => t.assigneeId === aarav.id), now, TZ);
    expect([snapshot.total, snapshot.completed, snapshot.overdue]).toEqual([live.total, live.completed, live.overdue]);
  });

  it('keeps an inactive employee and a moved employee for history', () => {
    expect(person("Liam O'Brien").isActive).toBe(false);
    expect(seed.memberships.filter((m) => m.userId === person('Zara Ahmed').id)).toHaveLength(2);
  });
});
