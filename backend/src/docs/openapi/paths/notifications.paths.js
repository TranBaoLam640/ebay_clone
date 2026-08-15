import {
  collection,
  idParam,
  operation,
  query,
  ref,
  response,
  security,
  pageParams,
} from '../components/index.js';

export const notificationPaths = {
  '/notifications': {
    get: operation({
      tag: 'Notifications',
      operationId: 'listNotifications',
      summary: 'List notifications',
      parameters: [
        ...pageParams,
        query('isRead', { type: 'string', enum: ['true', 'false'] }),
        query('type', {
          type: 'string',
          enum: [
            'ACCOUNT',
            'ORDER',
            'PAYMENT',
            'RETURN',
            'PROMOTION',
            'SYSTEM',
          ],
        }),
      ],
      success: response('Notifications', collection('Notification'), true),
      errors: [400, 401, 429, 500],
      security: security.access,
    }),
  },
  '/notifications/unread-count': {
    get: operation({
      tag: 'Notifications',
      operationId: 'getUnreadNotificationCount',
      summary: 'Get unread notification count',
      success: response('Unread count', {
        type: 'object',
        properties: { count: { type: 'integer', minimum: 0 } },
      }),
      errors: [401, 429, 500],
      security: security.access,
    }),
  },
  '/notifications/read-all': {
    patch: operation({
      tag: 'Notifications',
      operationId: 'markAllNotificationsRead',
      summary: 'Mark all notifications as read',
      errors: [401, 429, 500],
      security: security.unsafe,
    }),
  },
  '/notifications/{notificationId}/read': {
    patch: operation({
      tag: 'Notifications',
      operationId: 'markNotificationRead',
      summary: 'Mark a notification as read',
      parameters: [idParam('notificationId')],
      success: response('Notification marked read', ref('Notification')),
      errors: [400, 401, 404, 429, 500],
      security: security.unsafe,
    }),
  },
};
