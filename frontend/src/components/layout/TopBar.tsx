'use client';

import { Menu, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId } from 'react';
import { LogoMark } from '@/components/brand/Logo';
import { NotificationsPopover } from '@/components/notifications/NotificationsPopover';
import { Button } from '@/components/ui/Button';
import { inputClasses } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { useUser } from '@/lib/session';
import { UserMenu } from './UserMenu';

/** Lightweight utility bar: navigation toggle, task search, notifications, account (Frontend.md §19, §134). */
export function TopBar({ onOpenNavigation }: { onOpenNavigation: () => void }) {
  const router = useRouter();
  const searchId = useId();
  const user = useUser();
  const searchLabel = user.role === 'EMPLOYEE' ? 'Search my tasks' : 'Search tasks';

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border-subtle bg-canvas px-4 sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" onClick={onOpenNavigation} aria-label="Open navigation">
        <Menu className="size-5" />
      </Button>
      <Link href="/dashboard" className="flex items-center gap-2 rounded-md lg:hidden">
        <LogoMark className="size-7" />
        <span className="text-base font-bold tracking-tight text-ink">ZEMP</span>
      </Link>

      <form
        role="search"
        className="relative hidden w-full max-w-sm md:ml-4 md:block lg:ml-0"
        onSubmit={(event) => {
          event.preventDefault();
          const query = new FormData(event.currentTarget).get('q')?.toString().trim();
          router.push(query ? `/tasks?search=${encodeURIComponent(query)}` : '/tasks');
        }}
      >
        <label htmlFor={searchId} className="sr-only">
          {searchLabel}
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
        <input id={searchId} name="q" type="search" placeholder={`${searchLabel}…`} className={cn(inputClasses, 'pl-10')} />
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <NotificationsPopover />
        <UserMenu />
      </div>
    </header>
  );
}
