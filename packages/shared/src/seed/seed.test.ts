import { describe, expect, it } from 'vitest';
import { DEMO_TEAMS, PEOPLE } from './catalog.js';
import { DEMO_PASSWORD, generateSeed } from './index.js';

const TZ = 'Asia/Kolkata';
const now = new Date('2026-09-18T06:30:00Z'); // 12:00 IST
const seed = generateSeed({ now, timeZone: TZ });
const person = (name: string) => seed.users.find((u) => u.name === name)!;
const team = (name: string) => seed.teams.find((t) => t.name === name)!;

describe('demo seed', () => {
  it('seeds exactly the roster from the Demo_Data sheet', () => {
    expect(seed.users.map((u) => u.name)).toEqual(PEOPLE.map((p) => p.name));
    expect(seed.users.map((u) => [u.email, u.employeeCode, u.role])).toEqual(
      PEOPLE.map((p) => [p.email, p.employeeCode, p.role]),
    );
    expect(person('Test User').role).toBe('SUPER_ADMIN');
    expect(person('Dipro Pathak').role).toBe('SUPER_ADMIN');
    expect(new Set(seed.users.map((u) => u.email)).size).toBe(seed.users.length);
    expect(new Set(seed.users.map((u) => u.employeeCode)).size).toBe(seed.users.length);
    expect(DEMO_PASSWORD).toBe('1234567890');
  });

  it('puts each team under its own admin, with every other member in it', () => {
    expect(seed.teams).toHaveLength(DEMO_TEAMS.length);
    expect(team('CXO').ownerId).toBe(person('Dipro Pathak').id);
    expect(team('Content').ownerId).toBe(person('Faisal Maqbool').id);

    for (const definition of DEMO_TEAMS) {
      const members = seed.memberships.filter((m) => m.teamId === team(definition.name).id && !m.leftAt).map((m) => m.userId);
      const expected = PEOPLE.filter((p) => p.team === definition.name).map((p) => person(p.name).id);
      expect(members).toEqual(expected);
    }
    // The platform Super Admin runs the organization rather than sitting in a team.
    expect(seed.memberships.some((m) => m.userId === person('Test User').id)).toBe(false);
  });

  it('is deterministic for a given moment', () => {
    const again = generateSeed({ now, timeZone: TZ });
    const shape = (s: typeof seed) => s.users.map((u) => [u.id, u.email]);
    expect(shape(again)).toEqual(shape(seed));
  });

  it('starts as a blank slate — no tasks, activity, comments, notifications or audit history', () => {
    expect(seed.tasks).toHaveLength(0);
    expect(seed.activities).toHaveLength(0);
    expect(seed.comments).toHaveLength(0);
    expect(seed.notifications).toHaveLength(0);
    expect(seed.auditLogs).toHaveLength(0);
    expect(seed.snapshots).toHaveLength(0);
  });
});
