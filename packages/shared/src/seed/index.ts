import type { TaskRecord } from '../domain/tasks.js';
import type {
  AuditAction,
  AuditResourceType,
  AuditResult,
  NotificationType,
  RiskLevel,
  SystemRole,
  TaskActivityType,
} from '../enums.js';
import { DEMO_TEAMS, ORGANIZATION, PEOPLE, type SeedPerson, type SeedTeamDef } from './catalog.js';

export * from './catalog.js';

/**
 * Live organization, seeded from the customer's Demo_Data sheet: the current roster and its two
 * teams, with no task, activity, comment, notification or audit history — a blank slate the team
 * populates by using the app. Used by the mock API and the database seed.
 */

/**
 * Development-only password shared by every seeded account. The sheet's own per-person passwords
 * are intentionally not committed to source control — real credentials must never live in git.
 */
export const DEMO_PASSWORD = '1234567890';

export interface SeedUser {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
  isActive: boolean;
  jobTitle: string;
  employeeCode: string;
  phone: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface SeedTeam {
  id: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeedMembership {
  id: string;
  teamId: string;
  userId: string;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface SeedTask extends TaskRecord {
  completionNote: string | null;
  createdById: string;
  updatedById: string;
  updatedAt: Date;
}

export interface SeedActivity {
  id: string;
  taskId: string;
  actorId: string;
  type: TaskActivityType;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  createdAt: Date;
}

export interface SeedComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: Date;
}

export interface SeedNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  taskId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface SeedAuditLog {
  id: string;
  actorId: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  result: AuditResult;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface SeedSnapshot {
  id: string;
  date: string;
  userId: string;
  teamId: string | null;
  total: number;
  completed: number;
  todo: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  completedOnDay: number;
  assignedOnDay: number;
  risk: RiskLevel | null;
  createdAt: Date;
}

export interface SeedData {
  organization: { name: string; timezone: string };
  users: SeedUser[];
  teams: SeedTeam[];
  memberships: SeedMembership[];
  tasks: SeedTask[];
  activities: SeedActivity[];
  comments: SeedComment[];
  notifications: SeedNotification[];
  auditLogs: SeedAuditLog[];
  snapshots: SeedSnapshot[];
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function emailFor(name: string) {
  const local = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('.');
  return `${local}@zemp.test`;
}

export function generateSeed(options: { now?: Date; timeZone?: string } = {}): SeedData {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? ORGANIZATION.timezone;
  const rand = mulberry32(20260918);
  const id = () => {
    const hex = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
    hex[12] = '4';
    hex[16] = (8 + Math.floor(rand() * 4)).toString(16);
    const s = hex.join('');
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  };

  const users: SeedUser[] = [];
  const teams: SeedTeam[] = [];
  const memberships: SeedMembership[] = [];

  const addUser = (definition: SeedPerson): SeedUser => {
    const user: SeedUser = {
      id: id(),
      email: definition.email,
      name: definition.name,
      role: definition.role,
      isActive: true,
      jobTitle: definition.jobTitle,
      employeeCode: definition.employeeCode,
      phone: definition.phone,
      createdAt: now,
      lastLoginAt: null,
    };
    users.push(user);
    return user;
  };

  const person = new Map<string, SeedUser>();
  for (const definition of PEOPLE) person.set(definition.name, addUser(definition));

  const addTeam = (definition: SeedTeamDef): SeedTeam => {
    const owner = PEOPLE.find((p) => p.team === definition.name && p.ownsTeam);
    const seedTeam: SeedTeam = {
      id: id(),
      name: definition.name,
      description: definition.description,
      ownerId: owner ? person.get(owner.name)!.id : null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    teams.push(seedTeam);
    for (const definition2 of PEOPLE.filter((p) => p.team === seedTeam.name)) {
      const user = person.get(definition2.name)!;
      memberships.push({ id: id(), teamId: seedTeam.id, userId: user.id, joinedAt: now, leftAt: null });
    }
    return seedTeam;
  };

  for (const definition of DEMO_TEAMS) addTeam(definition);

  return {
    organization: { name: ORGANIZATION.name, timezone: timeZone },
    users,
    teams,
    memberships,
    tasks: [],
    activities: [],
    comments: [],
    notifications: [],
    auditLogs: [],
    snapshots: [],
  };
}
