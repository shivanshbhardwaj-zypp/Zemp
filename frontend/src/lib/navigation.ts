import type { SessionUser } from '@zemp/shared';
import {
  Bell,
  ChartColumn,
  ClipboardCheck,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that keep this item active, e.g. detail pages. */
  activePrefixes?: string[];
}

export interface Navigation {
  main: NavItem[];
  /** Separated administration items (Super Admin only). */
  administration: NavItem[];
  footer: NavItem[];
}

const notifications: NavItem = { href: '/notifications', label: 'Notifications', icon: Bell };
const settings: NavItem = { href: '/settings', label: 'Settings', icon: Settings, activePrefixes: ['/settings', '/profile'] };
const reports: NavItem = { href: '/reports', label: 'Reports', icon: ChartColumn };
const reviews: NavItem = { href: '/reviews', label: 'Reviews', icon: ClipboardCheck };

/**
 * Role navigation from Frontend.md §124. Unavailable modules are omitted rather than disabled.
 * This is presentation only — every route and API call is authorized on the server.
 */
export function navigationFor(user: SessionUser): Navigation {
  switch (user.role) {
    case 'SUPER_ADMIN':
      return {
        main: [
          { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/tasks', label: 'Tasks', icon: ListChecks },
          { href: '/employees', label: 'Employees', icon: Users, activePrefixes: ['/employees', '/organization'] },
          { href: '/teams', label: 'Teams', icon: UsersRound },
          reviews,
          reports,
        ],
        administration: [
          { href: '/admins', label: 'Admins', icon: ShieldCheck },
          { href: '/audit', label: 'Audit Log', icon: ScrollText },
        ],
        footer: [notifications, settings],
      };
    case 'ADMIN':
      return {
        main: [
          { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/tasks', label: 'Tasks', icon: ListChecks },
          { href: '/teams', label: 'My Team', icon: UsersRound, activePrefixes: ['/teams', '/employees'] },
          reviews,
          reports,
        ],
        administration: [],
        footer: [notifications, settings],
      };
    case 'EMPLOYEE':
      return {
        main: [
          { href: '/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
          { href: '/tasks', label: 'My Tasks', icon: ListChecks },
          { href: '/progress', label: 'My Progress', icon: TrendingUp },
        ],
        administration: [],
        footer: [notifications, { href: '/profile', label: 'Profile', icon: UserRound, activePrefixes: ['/profile', '/settings'] }],
      };
  }
}

export function isActive(item: NavItem, pathname: string) {
  return (item.activePrefixes ?? [item.href]).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
