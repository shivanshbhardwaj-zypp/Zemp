import { ROLE_PERMISSIONS, type SessionUser } from '@zemp/shared';
import { describe, expect, it } from 'vitest';
import { isActive, navigationFor } from './navigation';

const user = (role: SessionUser['role']): SessionUser => ({
  id: 'u1',
  name: 'Test User',
  email: 'test@zemp.test',
  role,
  permissions: [...ROLE_PERMISSIONS[role]],
  jobTitle: null,
  employeeCode: null,
  team: null,
  manager: null,
  ownedTeams: [],
  organization: { name: 'ZEMP Demo Co.', timezone: 'Asia/Kolkata' },
});

const hrefs = (role: SessionUser['role']) => {
  const nav = navigationFor(user(role));
  return [...nav.main, ...nav.administration, ...nav.footer].map((item) => item.href);
};

describe('navigationFor', () => {
  it('gives the Super Admin the administration section', () => {
    expect(hrefs('SUPER_ADMIN')).toEqual(
      expect.arrayContaining(['/dashboard', '/tasks', '/employees', '/teams', '/reports', '/admins', '/audit']),
    );
  });

  it('hides admin-only modules from an admin', () => {
    const items = hrefs('ADMIN');
    expect(items).toContain('/reports');
    expect(items).not.toContain('/admins');
    expect(items).not.toContain('/audit');
  });

  it('limits an employee to their own work', () => {
    const items = hrefs('EMPLOYEE');
    expect(items).toEqual(['/dashboard', '/tasks', '/progress', '/incentives', '/notifications', '/profile']);
    expect(items).not.toContain('/employees');
    expect(items).not.toContain('/teams');
  });

  it('keeps Incentives out of every manager panel', () => {
    expect(hrefs('SUPER_ADMIN')).not.toContain('/incentives');
    expect(hrefs('ADMIN')).not.toContain('/incentives');
    expect(hrefs('SUB_ADMIN')).not.toContain('/incentives');
  });
});

describe('isActive', () => {
  const tasks = { href: '/tasks', label: 'Tasks', icon: (() => null) as never };

  it('matches the item and its detail pages', () => {
    expect(isActive(tasks, '/tasks')).toBe(true);
    expect(isActive(tasks, '/tasks/abc')).toBe(true);
  });

  it('does not match a different route with the same prefix', () => {
    expect(isActive(tasks, '/tasks-archive')).toBe(false);
    expect(isActive(tasks, '/dashboard')).toBe(false);
  });

  it('honours extra active prefixes', () => {
    const settings = { ...tasks, href: '/settings', activePrefixes: ['/settings', '/profile'] };
    expect(isActive(settings, '/profile')).toBe(true);
  });
});
