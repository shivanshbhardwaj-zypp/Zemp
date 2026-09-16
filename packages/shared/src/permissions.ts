import type { SystemRole } from './enums.js';

/** Permission catalogue (requirements.md §19). Roles map to permissions; scope rules refine them. */
export const PERMISSIONS = [
  'users.read',
  'users.create',
  'users.update',
  'users.deactivate',
  'teams.read',
  'teams.create',
  'teams.update',
  'teams.delete',
  'tasks.read',
  'tasks.create',
  'tasks.assign',
  'tasks.update',
  'tasks.reassign',
  'tasks.complete',
  'tasks.delete',
  'reports.read',
  'reports.organization',
  'reports.team',
  'reports.employee',
  'audit.read',
  'settings.read',
  'settings.update',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'users.read': 'View people within scope',
  'users.create': 'Create admins and employees',
  'users.update': 'Edit people and move them between teams',
  'users.deactivate': 'Deactivate and reactivate accounts',
  'teams.read': 'View teams within scope',
  'teams.create': 'Create teams',
  'teams.update': 'Edit teams, owners and membership',
  'teams.delete': 'Deactivate teams',
  'tasks.read': 'View tasks within scope',
  'tasks.create': 'Create tasks',
  'tasks.assign': 'Assign tasks to people within scope',
  'tasks.update': 'Update tasks within scope',
  'tasks.reassign': 'Reassign tasks within scope',
  'tasks.complete': 'Complete tasks',
  'tasks.delete': 'Cancel tasks',
  'reports.read': 'View reports',
  'reports.organization': 'View organization-wide reports',
  'reports.team': 'View team reports within scope',
  'reports.employee': 'View employee reports within scope',
  'audit.read': 'View the audit log',
  'settings.read': 'View organization settings',
  'settings.update': 'Change organization settings',
};

/**
 * Default role → permission mapping. Seeded into the Role/Permission tables; the database copy is
 * authoritative at runtime. Admin data is additionally limited to teams the admin owns, and
 * employee data to their own work — see domain/access.ts.
 */
export const ROLE_PERMISSIONS: Record<SystemRole, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN: [
    'users.read',
    'teams.read',
    'tasks.read',
    'tasks.create',
    'tasks.assign',
    'tasks.update',
    'tasks.reassign',
    'tasks.complete',
    'tasks.delete',
    'reports.read',
    'reports.team',
    'reports.employee',
  ],
  EMPLOYEE: ['tasks.read', 'tasks.update', 'tasks.complete', 'reports.read', 'reports.employee'],
};
