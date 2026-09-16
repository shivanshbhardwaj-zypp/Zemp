'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api/dashboard';

/** Independent sections load independently (Frontend.md §106) and refresh every few minutes (§168). */
const REFRESH_MS = 5 * 60_000;

export function useDashboardSummary() {
  return useQuery({ queryKey: ['dashboard', 'summary'], queryFn: dashboardApi.summary, refetchInterval: REFRESH_MS });
}

export function useDashboardAttention() {
  return useQuery({ queryKey: ['dashboard', 'attention'], queryFn: dashboardApi.attention, refetchInterval: REFRESH_MS });
}
