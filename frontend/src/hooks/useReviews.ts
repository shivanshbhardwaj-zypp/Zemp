'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListReviewsQuery, ResubmitSelfReportInput, ReviewDecisionInput, SelfReportInputDto } from '@zemp/shared';
import { reviewsApi } from '@/lib/api/reviews';
import { invalidateWorkData } from './useTasks';

export const reviewKeys = {
  queue: (query: Partial<ListReviewsQuery>) => ['reviews', 'queue', query] as const,
  reviewers: ['reviews', 'reviewers'] as const,
};

/** Approving work changes dashboards and reports too, so every work query is refreshed. */
function useReviewMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      return invalidateWorkData(queryClient);
    },
  });
}

export function useReviewQueue(query: Partial<ListReviewsQuery>, enabled = true) {
  return useQuery({
    queryKey: reviewKeys.queue(query),
    queryFn: () => reviewsApi.queue(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useReviewerOptions(enabled = true) {
  return useQuery({ queryKey: reviewKeys.reviewers, queryFn: reviewsApi.reviewers, enabled, staleTime: 60_000 });
}

export const useSubmitWork = () => useReviewMutation((input: SelfReportInputDto) => reviewsApi.submit(input));
export const useResubmitWork = (id: string) =>
  useReviewMutation((input: ResubmitSelfReportInput) => reviewsApi.resubmit(id, input));
export const useReviewDecision = (id: string) =>
  useReviewMutation((input: ReviewDecisionInput) => reviewsApi.decide(id, input));
