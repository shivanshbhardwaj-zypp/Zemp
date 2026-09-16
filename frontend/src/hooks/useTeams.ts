'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AddTeamMemberInput, CreateTeamInput, ListTeamsQuery, UpdateTeamInput } from '@zemp/shared';
import { teamsApi } from '@/lib/api/teams';
import { invalidateWorkData } from './useTasks';

export function useTeams(query: Partial<ListTeamsQuery>, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['teams', 'list', query],
    queryFn: () => teamsApi.list(query),
    placeholderData: keepPreviousData,
    ...options,
  });
}

/** Active teams the viewer may see, for selects. The server applies the scope. */
export function useTeamOptions(enabled = true) {
  return useQuery({
    queryKey: ['teams', 'options'],
    queryFn: () => teamsApi.list({ status: 'active', page: 1, pageSize: 100 }),
    select: (page) => page.items,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useTeam(id: string) {
  return useQuery({ queryKey: ['teams', 'detail', id], queryFn: () => teamsApi.get(id) });
}

export function useTeamMembers(id: string, enabled = true) {
  return useQuery({ queryKey: ['teams', 'members', id], queryFn: () => teamsApi.members(id), enabled: enabled && !!id });
}

export function useOrgChart() {
  return useQuery({ queryKey: ['teams', 'org-chart'], queryFn: teamsApi.orgChart });
}

function useTeamMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => invalidateWorkData(queryClient) });
}

export const useCreateTeam = () => useTeamMutation((input: CreateTeamInput) => teamsApi.create(input));
export const useUpdateTeam = (id: string) => useTeamMutation((input: UpdateTeamInput) => teamsApi.update(id, input));
export const useAddTeamMember = (id: string) => useTeamMutation((input: AddTeamMemberInput) => teamsApi.addMember(id, input));
