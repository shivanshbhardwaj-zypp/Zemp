import type {
  AssignableUser,
  AssignableUsersQuery,
  ChangeStatusInput,
  CreateCommentInput,
  CreateTaskInput,
  IncentiveOverview,
  ListTasksQuery,
  ReassignTaskInput,
  TaskActivityEntry,
  TaskCommentEntry,
  TaskDetail,
  TaskSummary,
  UpdateTaskInput,
} from '@zemp/shared';
import { api } from './client';

export const tasksApi = {
  list: (query: Partial<ListTasksQuery>) => api.page<TaskSummary>('/tasks', query),
  get: (id: string) => api.get<TaskDetail>(`/tasks/${id}`),
  create: (input: CreateTaskInput) => api.post<TaskDetail>('/tasks', input),
  update: (id: string, input: UpdateTaskInput) => api.patch<TaskDetail>(`/tasks/${id}`, input),
  updateProgress: (id: string, progress: number) => api.patch<TaskDetail>(`/tasks/${id}/progress`, { progress }),
  changeStatus: (id: string, input: ChangeStatusInput) => api.patch<TaskDetail>(`/tasks/${id}/status`, input),
  reassign: (id: string, input: ReassignTaskInput) => api.patch<TaskDetail>(`/tasks/${id}/assignee`, input),
  activity: (id: string) => api.get<TaskActivityEntry[]>(`/tasks/${id}/activity`),
  comments: (id: string) => api.get<TaskCommentEntry[]>(`/tasks/${id}/comments`),
  addComment: (id: string, input: CreateCommentInput) => api.post<TaskCommentEntry>(`/tasks/${id}/comments`, input),
  assignableUsers: (query: Partial<AssignableUsersQuery>) => api.get<AssignableUser[]>('/tasks/assignable-users', query),
  incentives: () => api.get<IncentiveOverview>('/incentives'),
};
