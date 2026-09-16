import type { DashboardAttention, DashboardSummary } from '@zemp/shared';
import { api } from './client';

export const dashboardApi = {
  summary: () => api.get<DashboardSummary>('/dashboard/summary'),
  attention: () => api.get<DashboardAttention>('/dashboard/attention'),
};
