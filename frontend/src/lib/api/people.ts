import type {
  AdminListItem,
  ChangeRoleInput,
  CreateAdminInput,
  CreateEmployeeInput,
  EmployeeDetail,
  EmployeeListItem,
  ListPeopleQuery,
  PasswordResetIssued,
  PeopleStats,
  UpdateAdminInput,
  UpdateEmployeeInput,
} from '@zemp/shared';
import { api } from './client';

export const peopleApi = {
  employees: (query: Partial<ListPeopleQuery>) => api.page<EmployeeListItem>('/employees', query),
  employeeStats: () => api.get<PeopleStats>('/employees/stats'),
  employee: (id: string) => api.get<EmployeeDetail>(`/employees/${id}`),
  createEmployee: (input: CreateEmployeeInput) => api.post<EmployeeDetail>('/employees', input),
  updateEmployee: (id: string, input: UpdateEmployeeInput) => api.patch<EmployeeDetail>(`/employees/${id}`, input),
  admins: (query: Partial<ListPeopleQuery>) => api.page<AdminListItem>('/admins', query),
  createAdmin: (input: CreateAdminInput) => api.post<AdminListItem>('/admins', input),
  updateAdmin: (id: string, input: UpdateAdminInput) => api.patch<AdminListItem>(`/admins/${id}`, input),
  /** Promote a team member to Sub Admin, or return them to Employee. */
  changeRole: (id: string, input: ChangeRoleInput) => api.patch<EmployeeDetail>(`/employees/${id}/role`, input),
  deactivate: (id: string) => api.post<EmployeeDetail>(`/users/${id}/deactivate`),
  reactivate: (id: string) => api.post<EmployeeDetail>(`/users/${id}/reactivate`),
  issuePasswordReset: (id: string) => api.post<PasswordResetIssued>(`/users/${id}/password-reset`),
};
