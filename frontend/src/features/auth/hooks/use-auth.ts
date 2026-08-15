import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../services/auth-api';
import { ApiError } from '@/services/types';
import type {
  LoginPayload,
  RegisterPayload,
  VerifyEmailPayload,
} from '../types/auth.types';

const ME_KEY = ['auth', 'me'] as const;

/**
 * Central auth hook. The `me` query is the single source of truth for the
 * logged-in user; a 401 (not authenticated) resolves to `null` rather than an
 * error so guards can branch cleanly.
 */
export function useAuth() {
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const invalidateMe = () => qc.invalidateQueries({ queryKey: ME_KEY });

  const login = useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: invalidateMe,
  });

  const register = useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
  });

  const verifyEmail = useMutation({
    mutationFn: (payload: VerifyEmailPayload) => authApi.verifyEmail(payload),
  });

  const logout = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      qc.setQueryData(ME_KEY, null);
      qc.clear();
    },
  });

  return {
    user: meQuery.data ?? null,
    isAuthenticated: !!meQuery.data,
    isLoading: meQuery.isLoading,
    login,
    register,
    verifyEmail,
    logout,
    refetchMe: meQuery.refetch,
  };
}
