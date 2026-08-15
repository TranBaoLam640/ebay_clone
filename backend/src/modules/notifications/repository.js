import { Notification } from './notification.model.js';
export const create = (data, session) =>
  session
    ? Notification.create([data], { session }).then(([item]) => item)
    : Notification.create(data);
export const createUnique = (data, session) =>
  Notification.findOneAndUpdate(
    { userId: data.userId, eventKey: data.eventKey },
    { $setOnInsert: data },
    { upsert: true, returnDocument: 'after', session, runValidators: true },
  );
export const list = (filter, skip, limit) =>
  Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
export const count = (filter) => Notification.countDocuments(filter);
export const markRead = (userId, _id) =>
  Notification.findOneAndUpdate(
    { userId, _id },
    { isRead: true, readAt: new Date() },
    { returnDocument: 'after' },
  );
export const markAllRead = (userId) =>
  Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() },
  );
