import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/services/types';

/**
 * Shared TanStack Query client.
 * - staleTime 60s: catalog data changes infrequently; avoids refetch storms and
 *   lets revisited pages render instantly from cache (no spinner).
 * - gcTime 10m: keep unused query data cached long after leaving a page so
 *   navigating back is instant even on a slow connection.
 * - retry: never retry 4xx (client/validation/auth); on flaky networks retry
 *   other errors twice with capped backoff instead of failing fast.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
    mutations: {
      retry: false,
    },
  },
});
