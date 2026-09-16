import type {
  ActivityFeedItem,
  ActivityFeedQuery,
  DailyReport,
  DailyReportQuery,
  ProgressReport,
  ProgressReportQuery,
} from '@zemp/shared';
import { api } from './client';

export const reportsApi = {
  daily: (query: Partial<DailyReportQuery>) => api.get<DailyReport>('/reports/daily', query),
  progress: (query: ProgressReportQuery) => api.get<ProgressReport>('/reports/progress', query),
  activity: (query: Partial<ActivityFeedQuery>) => api.get<ActivityFeedItem[]>('/activity', query),
};
