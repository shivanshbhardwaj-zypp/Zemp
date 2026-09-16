'use client';

import { ROLE_LABELS } from '@zemp/shared';
import { Bell, LogOut, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import { UserAvatar } from '@/components/ui/Avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { useSignOut } from '@/hooks/useSignOut';
import { useUser } from '@/lib/session';

/** Avatar menu: name, role, profile, notifications, settings, log out (Frontend.md §50). */
export function UserMenu() {
  const user = useUser();
  const signOut = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.name}`}
        className="rounded-full transition-[scale] duration-150 ease-out active:scale-95"
      >
        <UserAvatar name={user.name} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
          <p className="truncate text-meta text-ink-muted">
            {ROLE_LABELS[user.role]}
            {user.jobTitle ? ` · ${user.jobTitle}` : ''}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/notifications">
            <Bell />
            Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
