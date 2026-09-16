import { describe, expect, it } from 'vitest';
import { summarizeWorkload } from '../domain/workload.js';
import { PEOPLE } from './catalog.js';
import { DEMO_PASSWORD, generateSeed } from './index.js';

const TZ = 'Asia/Kolkata';
const now = new Date('2026-09-15T06:30:00Z'); // 12:00 IST
const seed = generateSeed({ now, timeZone: TZ });
const person = (name: string) => seed.users.find((u) => u.name === name)!;

describe('demo seed', () => {
  it('seeds exactly the people from the Demo_Data sheet', () => {
    expect(seed.users.map((u) => u.name)).toEqual(PEOPLE.map((p) => p.name));
    expect(seed.users.map((u) => [u.email, u.employeeCode, u.role])).toEqual(
      PEOPLE.map((p) => [p.email, p.employeeCode, p.role]),
    );
    expect(person('Dipro').role).toBe('SUPER_ADMIN'); // "Super Admin/Admin" on the sheet
    expect(person('Shivansh').role).toBe('ADMIN');
    expect(new Set(seed.users.map((u) => u.email)).size).toBe(seed.users.length);
    expect(new Set(seed.users.map((u) => u.employeeCode)).size).toBe(seed.users.length);
    expect(DEMO_PASSWORD).toBe('1234567890');
  });

  it('puts the CXO team under its admin, with every other member in it', () => {
    expect(seed.teams).toHaveLength(1);
    const team = seed.teams[0]!;
    expect(team.name).toBe('CXO');
    expect(team.ownerId).toBe(person('Shivansh').id);
    const members = seed.memberships.filter((m) => m.teamId === team.id && !m.leftAt).map((m) => m.userId);
    expect(members).toEqual(PEOPLE.filter((p) => p.inTeam).map((p) => person(p.name).id));
    // The platform Super Admin runs the organization rather than sitting in a team.
    expect(members).not.toContain(person('Test User').id);
  });

  it('is deterministic for a given moment', () => {
    const again = generateSeed({ now, timeZone: TZ });
    const shape = (s: typeof seed) => s.tasks.map((t) => [t.id, t.status, t.progress, t.dueAt.getTime()]);
    expect(shape(again)).toEqual(shape(seed));
  });

  it('gives every team member work, and the admin work of their own', () => {
    for (const name of ['Neeraj', 'Saurav']) {
      expect(seed.tasks.filter((t) => t.assigneeId === person(name).id).length).toBeGreaterThan(5);
    }
    const adminTasks = seed.tasks.filter((t) => t.assigneeId === person('Shivansh').id);
    expect(adminTasks.length).toBeGreaterThan(0);
    expect(adminTasks.every((t) => t.assignorId === person('Test User').id)).toBe(true);
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
    const neeraj = person('Neeraj');
    const snapshot = seed.snapshots.find((s) => s.userId === neeraj.id && s.date === '2026-09-15')!;
    const live = summarizeWorkload(
      seed.tasks.filter((t) => t.assigneeId === neeraj.id),
      now,
      TZ,
    );
    expect([snapshot.total, snapshot.completed, snapshot.overdue]).toEqual([live.total, live.completed, live.overdue]);
  });

  it('leaves self-reported work for both review queues', () => {
    const submissions = seed.tasks.filter((t) => t.origin === 'SELF_REPORTED');
    expect(submissions.length).toBeGreaterThan(0);
    expect(submissions.every((t) => t.reviewStatus !== null && t.reviewerId !== null)).toBe(true);
    const reviewers = new Set(submissions.map((t) => t.reviewerId));
    expect(reviewers).toContain(person('Shivansh').id);
    expect(reviewers).toContain(person('Test User').id);
  });
});
