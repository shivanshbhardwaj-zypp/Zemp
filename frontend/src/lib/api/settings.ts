import type { OrganizationSettings, RoleMatrix, UpdateOrganizationInput } from '@zemp/shared';
import { api } from './client';

export const settingsApi = {
  organization: () => api.get<OrganizationSettings>('/settings/organization'),
  updateOrganization: (input: UpdateOrganizationInput) => api.patch<OrganizationSettings>('/settings/organization', input),
  roles: () => api.get<RoleMatrix>('/settings/roles'),
};
