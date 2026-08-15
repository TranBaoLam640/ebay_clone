import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi, type NotificationQuery } from '../services/notification-api';
import { useAuth } from '@/features/auth/hooks/use-auth';

export function useUnreadCount() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.unreadCount(),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useNotifications(query: NotificationQuery) {
  return useQuery({
    queryKey: ['notifications', 'list', query],
    queryFn: () => notificationApi.list(query),
  });
}

export function useNotificationActions() {
  const qc = useQueryClient();
  // Refetch every notifications query (lists in the bell + page, and the header
  // unread badge) so all views converge on the server state.
  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    // Optimistically decrement the header badge so it reflects the change
    // instantly, before the refetch round-trip completes.
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications', 'unread-count'] });
      const prev = qc.getQueryData<{ count: number }>(['notifications', 'unread-count']);
      if (prev) {
        qc.setQueryData(['notifications', 'unread-count'], {
          count: Math.max(0, prev.count - 1),
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      // Roll back the optimistic badge if the request failed.
      if (ctx?.prev) qc.setQueryData(['notifications', 'unread-count'], ctx.prev);
    },
    onSettled: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications', 'unread-count'] });
      const prev = qc.getQueryData<{ count: number }>(['notifications', 'unread-count']);
      qc.setQueryData(['notifications', 'unread-count'], { count: 0 });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications', 'unread-count'], ctx.prev);
    },
    onSettled: invalidate,
  });

  return { markRead, markAllRead };
}
