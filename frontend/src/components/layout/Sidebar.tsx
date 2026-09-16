'use client';

import { ROLE_LABELS } from '@zemp/shared';
import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { UserAvatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useSignOut } from '@/hooks/useSignOut';
import { cn } from '@/lib/cn';
import { isActive, navigationFor, type NavItem } from '@/lib/navigation';
import { useUser } from '@/lib/session';

/** `onNavigate` lets the mobile drawer close itself when a destination is chosen. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const user = useUser();
  const pathname = usePathname();
  const navigation = navigationFor(user);
  const unread = useUnreadCount().data?.count ?? 0;
  const signOut = useSignOut();

  const renderItems = (items: NavItem[]) => (
    <ul className="grid gap-1">
      {items.map((item) => {
        const active = isActive(item, pathname);
        const Icon = item.icon;
        const badge = item.href === '/notifications' && unread > 0 ? unread : null;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150',
                active ? 'bg-primary-strong text-white' : 'text-ink-secondary hover:bg-surface-hover hover:text-ink',
              )}
            >
              <Icon className="size-4.5 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{item.label}</span>
              {badge !== null && (
                <span
                  className={cn(
                    'min-w-6 rounded-full px-1.5 text-center text-xs font-semibold tabular',
                    active ? 'bg-white/20 text-white' : 'bg-primary-soft text-primary-ink',
                  )}
                >
                  <span className="sr-only">, </span>
                  {badge > 99 ? '99+' : badge}
                  <span className="sr-only"> unread</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav aria-label="Main" className="flex h-full flex-col px-4 py-5">
      <Link href="/dashboard" onClick={onNavigate} className="mb-7 self-start rounded-md px-2 py-1">
        <Logo />
        <span className="sr-only">Dashboard</span>
      </Link>
      {renderItems(navigation.main)}
      {navigation.administration.length > 0 && (
        <>
          <div role="separator" className="mx-3 my-4 h-px bg-border-subtle" />
          {renderItems(navigation.administration)}
        </>
      )}
      <div className="mt-auto grid gap-3 pt-6">
        {renderItems(navigation.footer)}
        <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-surface-subtle p-2.5">
          <UserAvatar name={user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-meta text-ink-muted">{ROLE_LABELS[user.role]}</p>
          </div>
          <Tooltip content="Log out">
            <button
              type="button"
              onClick={signOut}
              aria-label="Log out"
              className="flex size-8 shrink-0 items-center justify-center rounded-sm text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </Tooltip>
        </div>
      </div>
    </nav>
  );
}
