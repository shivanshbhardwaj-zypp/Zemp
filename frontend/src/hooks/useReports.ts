'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ActivityFeedQuery, DailyReportQuery, ProgressReportQuery } from '@zemp/shared';
import { reportsApi } from '@/lib/api/reports';

export function useDailyReport(query: Partial<DailyReportQuery>, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['reports', 'daily', query],
    queryFn: () => reportsApi.daily(query),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useProgressReport(query: ProgressReportQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['reports', 'progress', query],
    queryFn: () => reportsApi.progress(query),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useActivityFeed(query: Partial<ActivityFeedQuery>) {
  return useQuery({ queryKey: ['activity', query], queryFn: () => reportsApi.activity(query) });
}
