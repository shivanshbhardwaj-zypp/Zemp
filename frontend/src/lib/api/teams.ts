import type {
  AddTeamMemberInput,
  CreateTeamInput,
  ListTeamsQuery,
  OrgChart,
  TeamDetail,
  TeamListItem,
  TeamMemberItem,
  UpdateTeamInput,
} from '@zemp/shared';
import { api } from './client';

export const teamsApi = {
  list: (query: Partial<ListTeamsQuery>) => api.page<TeamListItem>('/teams', query),
  get: (id: string) => api.get<TeamDetail>(`/teams/${id}`),
  members: (id: string) => api.get<TeamMemberItem[]>(`/teams/${id}/members`),
  create: (input: CreateTeamInput) => api.post<TeamDetail>('/teams', input),
  update: (id: string, input: UpdateTeamInput) => api.patch<TeamDetail>(`/teams/${id}`, input),
  addMember: (id: string, input: AddTeamMemberInput) => api.post<TeamDetail>(`/teams/${id}/members`, input),
  orgChart: () => api.get<OrgChart>('/organization/chart'),
};
