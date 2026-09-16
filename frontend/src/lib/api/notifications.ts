import type { ListNotificationsQuery, NotificationItem } from '@zemp/shared';
import { api } from './client';

export const notificationsApi = {
  list: (query: Partial<ListNotificationsQuery>) => api.page<NotificationItem>('/notifications', query),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.post<null>(`/notifications/${id}/read`),
  markAllRead: () => api.post<null>('/notifications/read-all'),
};
