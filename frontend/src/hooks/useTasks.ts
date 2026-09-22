'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AssignableUsersQuery,
  BulkCreateTaskInput,
  ChangeStatusInput,
  CreateCommentInput,
  CreateTaskInput,
  ListTasksQuery,
  ReassignTaskInput,
  UpdateTaskInput,
} from '@zemp/shared';
import { tasksApi } from '@/lib/api/tasks';

export type TaskListParams = Partial<ListTasksQuery>;

export const taskKeys = {
  list: (params: TaskListParams) => ['tasks', 'list', params] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
  activity: (id: string) => ['tasks', 'activity', id] as const,
  comments: (id: string) => ['tasks', 'comments', id] as const,
  assignable: (query: Partial<AssignableUsersQuery>) => ['tasks', 'assignable', query] as const,
};

const WORK_DATA_ROOTS = new Set(['tasks', 'dashboard', 'reports', 'activity', 'employees', 'teams', 'admins', 'notifications']);

/** A task change affects dashboards, reports, people pages and notifications. */
export function invalidateWorkData(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ predicate: (query) => WORK_DATA_ROOTS.has(String(query.queryKey[0])) });
}

export function useTasks(params: TaskListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: taskKeys.list(params),
    queryFn: () => tasksApi.list(params),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useTask(id: string) {
  return useQuery({ queryKey: taskKeys.detail(id), queryFn: () => tasksApi.get(id) });
}

export function useTaskActivity(id: string) {
  return useQuery({ queryKey: taskKeys.activity(id), queryFn: () => tasksApi.activity(id) });
}

export function useTaskComments(id: string) {
  return useQuery({ queryKey: taskKeys.comments(id), queryFn: () => tasksApi.comments(id) });
}

export function useAssignableUsers(query: Partial<AssignableUsersQuery>, enabled = true) {
  return useQuery({
    queryKey: taskKeys.assignable(query),
    queryFn: () => tasksApi.assignableUsers(query),
    enabled,
    staleTime: 60_000,
  });
}

/** The viewer's own incentivized tasks — what they've earned and what's still open. */
export function useIncentiveOverview() {
  return useQuery({ queryKey: ['tasks', 'incentives'], queryFn: tasksApi.incentives });
}

function useWorkMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => invalidateWorkData(queryClient) });
}

export const useCreateTask = () => useWorkMutation((input: CreateTaskInput) => tasksApi.create(input));
export const useBulkCreateTask = () => useWorkMutation((input: BulkCreateTaskInput) => tasksApi.bulkCreate(input));
export const useUpdateTask = (id: string) => useWorkMutation((input: UpdateTaskInput) => tasksApi.update(id, input));
export const useUpdateProgress = (id: string) => useWorkMutation((progress: number) => tasksApi.updateProgress(id, progress));
export const useChangeStatus = (id: string) => useWorkMutation((input: ChangeStatusInput) => tasksApi.changeStatus(id, input));
export const useReassignTask = (id: string) => useWorkMutation((input: ReassignTaskInput) => tasksApi.reassign(id, input));
export const useAddComment = (id: string) => useWorkMutation((input: CreateCommentInput) => tasksApi.addComment(id, input));
