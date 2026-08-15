import { apiGet, apiMutate, clearCsrfToken } from '@/services/api-client';
import type {
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  RegisterResult,
  ResetPasswordPayload,
  UpdateProfilePayload,
  User,
  VerifyEmailPayload,
} from '../types/auth.types';

export const authApi = {
  me: () => apiGet<User>('/users/me'),

  register: (payload: RegisterPayload) =>
    apiMutate<RegisterResult>('post', '/auth/register', payload),

  verifyEmail: (payload: VerifyEmailPayload) =>
    apiMutate<{ verified: boolean }>('post', '/auth/verify-email', payload),

  resendVerification: (email: string) =>
    apiMutate<{ sent: boolean }>('post', '/auth/resend-verification', { email }),

  login: (payload: LoginPayload) =>
    apiMutate<{ user: Pick<User, 'id' | 'email'> }>('post', '/auth/login', payload),

  logout: async () => {
    const result = await apiMutate<{ loggedOut: boolean }>('post', '/auth/logout');
    clearCsrfToken();
    return result;
  },

  updateProfile: (payload: UpdateProfilePayload) =>
    apiMutate<User>('patch', '/users/me', payload),

  changePassword: (payload: ChangePasswordPayload) =>
    apiMutate<{ changed: boolean }>('patch', '/users/me/password', payload),

  forgotPassword: (email: string) =>
    apiMutate<{ sent: boolean }>('post', '/auth/forgot-password', { email }),

  resetPassword: (payload: ResetPasswordPayload) =>
    apiMutate<{ reset: boolean }>('post', '/auth/reset-password', payload),

  resendResetPassword: (email: string) =>
    apiMutate<{ sent: boolean }>('post', '/auth/resend-reset-password', { email }),
};
