import * as repository from './repository.js';
import { pagination, paginationMeta } from '../../common/utils/pagination.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';

// Serialize the Mongoose document to the public API shape: expose `id` (not the
// raw `_id`) so clients can address a notification for mark-as-read.
const toPublicNotification = (n) => ({
  id: n._id,
  type: n.type,
  title: n.title,
  message: n.message,
  isRead: n.isRead,
  readAt: n.readAt ?? null,
  referenceType: n.referenceType ?? null,
  referenceId: n.referenceId ?? null,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});
export const createNotification = (
  userId,
  { type, title, message, referenceType, referenceId, eventType, eventKey },
  session,
) =>
  (eventKey ? repository.createUnique : repository.create)(
    {
      userId,
      type,
      title,
      message,
      referenceType,
      referenceId,
      eventType,
      eventKey,
    },
    session,
  );
export const createAccountNotification = (userId, notification, session) =>
  createNotification(userId, { type: 'ACCOUNT', ...notification }, session);
export const list = async (userId, query) => {
  const { page, limit } = pagination(query);
  const filter = { userId };
  if (query.isRead !== undefined) filter.isRead = query.isRead === 'true';
  if (query.type) filter.type = query.type;
  const [items, total] = await Promise.all([
    repository.list(filter, (page - 1) * limit, limit),
    repository.count(filter),
  ]);
  return {
    items: items.map(toPublicNotification),
    meta: paginationMeta(page, limit, total),
  };
};
export const unreadCount = (userId) =>
  repository.count({ userId, isRead: false });
export const read = async (userId, id) => {
  const item = await repository.markRead(userId, id);
  if (!item)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Notification not found');
  return toPublicNotification(item);
};
export const readAll = async (userId) => {
  await repository.markAllRead(userId);
  return { read: true };
};
