import { apiGet, apiGetPaged, apiMutate } from '@/services/api-client';
import type { PaginationMeta } from '@/services/types';

export type NotificationType =
  | 'ACCOUNT'
  | 'ORDER'
  | 'PAYMENT'
  | 'RETURN'
  | 'DISPUTE'
  | 'PROMOTION'
  | 'SYSTEM'
  | 'AUCTION';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationQuery {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: NotificationType;
}

export const notificationApi = {
  list: (query: NotificationQuery): Promise<{ items: Notification[]; meta: PaginationMeta }> =>
    apiGetPaged<Notification>('/notifications', {
      ...query,
      isRead: query.isRead === undefined ? undefined : String(query.isRead),
    }),

  unreadCount: () => apiGet<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) =>
    apiMutate<Notification>('patch', `/notifications/${id}/read`),

  markAllRead: () => apiMutate<{ read: boolean }>('patch', '/notifications/read-all'),
};
