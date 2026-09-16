'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListNotificationsQuery } from '@zemp/shared';
import { notificationsApi } from '@/lib/api/notifications';

const keys = {
  all: ['notifications'] as const,
  list: (query: Partial<ListNotificationsQuery>) => ['notifications', 'list', query] as const,
  unread: ['notifications', 'unread-count'] as const,
};

export function useNotifications(query: Partial<ListNotificationsQuery>, options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: keys.list(query), queryFn: () => notificationsApi.list(query), ...options });
}

/** A gentle one-minute refresh keeps the badge current without hammering the API (Frontend.md §168). */
export function useUnreadCount() {
  return useQuery({ queryKey: keys.unread, queryFn: notificationsApi.unreadCount, refetchInterval: 60_000 });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}
