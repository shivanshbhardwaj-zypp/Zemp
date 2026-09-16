import type {
  ChangePasswordInput,
  LoginInput,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  SessionUser,
} from '@zemp/shared';
import { api } from './client';

export const authApi = {
  login: (input: LoginInput) => api.post<SessionUser>('/auth/login', input),
  logout: () => api.post<null>('/auth/logout'),
  me: () => api.get<SessionUser>('/auth/me'),
  changePassword: (input: ChangePasswordInput) => api.post<null>('/auth/password/change', input),
  requestPasswordReset: (input: PasswordResetRequestInput) => api.post<null>('/auth/password-reset/request', input),
  confirmPasswordReset: (input: PasswordResetConfirmInput) => api.post<null>('/auth/password-reset/confirm', input),
};
