'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateAdminInput, CreateEmployeeInput, ListPeopleQuery, UpdateAdminInput, UpdateEmployeeInput } from '@zemp/shared';
import { peopleApi } from '@/lib/api/people';
import { invalidateWorkData } from './useTasks';

export function useEmployees(query: Partial<ListPeopleQuery>, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['employees', 'list', query],
    queryFn: () => peopleApi.employees(query),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useEmployeeStats(enabled = true) {
  return useQuery({ queryKey: ['employees', 'stats'], queryFn: peopleApi.employeeStats, enabled });
}

export function useEmployee(id: string) {
  return useQuery({ queryKey: ['employees', 'detail', id], queryFn: () => peopleApi.employee(id) });
}

export function useAdmins(query: Partial<ListPeopleQuery>, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['admins', 'list', query],
    queryFn: () => peopleApi.admins(query),
    placeholderData: keepPreviousData,
    ...options,
  });
}

function usePeopleMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => invalidateWorkData(queryClient) });
}

export const useCreateEmployee = () => usePeopleMutation((input: CreateEmployeeInput) => peopleApi.createEmployee(input));
export const useUpdateEmployee = (id: string) =>
  usePeopleMutation((input: UpdateEmployeeInput) => peopleApi.updateEmployee(id, input));
export const useCreateAdmin = () => usePeopleMutation((input: CreateAdminInput) => peopleApi.createAdmin(input));
export const useUpdateAdmin = (id: string) => usePeopleMutation((input: UpdateAdminInput) => peopleApi.updateAdmin(id, input));
export const useSetAccountActive = () =>
  usePeopleMutation(({ id, active }: { id: string; active: boolean }) =>
    active ? peopleApi.reactivate(id) : peopleApi.deactivate(id),
  );
export const useIssuePasswordReset = () => useMutation({ mutationFn: (id: string) => peopleApi.issuePasswordReset(id) });
