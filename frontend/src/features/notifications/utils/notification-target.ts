import type { Notification } from '../services/notification-api';
import { paths } from '@/routes/paths';

export function notificationTarget(notification: Notification): string | null {
  if (!notification.referenceId) return null;
  if (notification.referenceType === 'INRRequest') {
    return paths.account.requestDispute(notification.referenceId);
  }
  return null;
}
