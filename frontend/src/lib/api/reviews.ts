import type {
  ListReviewsQuery,
  ResubmitSelfReportInput,
  ReviewDecisionInput,
  ReviewerOption,
  SelfReportInputDto,
  TaskDetail,
  TaskSummary,
} from '@zemp/shared';
import { api } from './client';

export const reviewsApi = {
  /** Who this employee may ask: their team admin and the Super Admin. */
  reviewers: () => api.get<ReviewerOption[]>('/reviews/reviewers'),
  submit: (input: SelfReportInputDto) => api.post<TaskDetail>('/tasks/self-report', input),
  resubmit: (id: string, input: ResubmitSelfReportInput) => api.post<TaskDetail>(`/tasks/${id}/resubmit`, input),
  queue: (query: Partial<ListReviewsQuery>) => api.page<TaskSummary>('/reviews', query),
  decide: (id: string, input: ReviewDecisionInput) => api.post<TaskDetail>(`/reviews/${id}/decision`, input),
};
