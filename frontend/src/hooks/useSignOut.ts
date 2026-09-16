'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { authApi } from '@/lib/api/auth';

export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // The session may already have ended; signing out locally is still correct.
    }
    queryClient.clear();
    router.replace('/login');
  }, [queryClient, router]);
}
