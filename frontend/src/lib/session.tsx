'use client';

import { useQuery } from '@tanstack/react-query';
import type { Permission, SessionUser } from '@zemp/shared';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect } from 'react';
import { ErrorState } from '@/components/shared/States';
import { Skeleton } from '@/components/ui/Skeleton';
import { authApi } from './api/auth';
import { ApiError } from './api/client';

export const sessionQueryKey = ['session'] as const;

const SessionContext = createContext<SessionUser | null>(null);

/** The signed-in user. Role and permissions come from the API session — visibility only, never security. */
export function useUser(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error('useUser must be used inside <SessionGate>');
  return user;
}

export function useCan() {
  const user = useUser();
  return (permission: Permission) => user.permissions.includes(permission);
}

export function useTimeZone() {
  return useUser().organization.timezone;
}

/** Resolves the session before rendering the app; unauthenticated visitors go to sign-in. */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useQuery({
    queryKey: sessionQueryKey,
    queryFn: authApi.me,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const unauthenticated = session.error instanceof ApiError && session.error.status === 401;

  useEffect(() => {
    if (unauthenticated) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [unauthenticated, pathname, router]);

  if (session.data) return <SessionContext value={session.data}>{children}</SessionContext>;
  if (session.error && !unauthenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ErrorState description="We couldn't load your workspace." onRetry={() => session.refetch()} />
      </div>
    );
  }
  return <ShellSkeleton />;
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true" aria-label="Loading your workspace">
      <div className="hidden w-60 shrink-0 flex-col gap-3 border-r border-border-subtle bg-surface p-5 lg:flex">
        <Skeleton className="mb-6 h-8 w-28" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="flex-1 p-8">
        <Skeleton className="h-8 w-56" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-34 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
