import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { messageAttachments } from '../uploads/upload.middleware.js';
import * as controller from './conversation.controller.js';
import {
  conversationIdSchema,
  createConversationSchema,
  listConversationsSchema,
  listMessagesSchema,
  sendMessageSchema,
} from './conversation.validation.js';

export const conversationRoute = Router();
conversationRoute.use(authenticate);
conversationRoute.get(
  '/',
  validate(listConversationsSchema),
  controller.listConversations,
);
conversationRoute.post(
  '/',
  validate(createConversationSchema),
  controller.createConversation,
);
conversationRoute.get(
  '/:id/messages',
  validate(listMessagesSchema),
  controller.getMessages,
);
conversationRoute.post(
  '/:id/messages',
  validate(sendMessageSchema),
  controller.sendMessage,
);
conversationRoute.post(
  '/:id/attachments',
  messageAttachments,
  controller.uploadAttachments,
);
conversationRoute.patch(
  '/:id/read',
  validate(conversationIdSchema),
  controller.markRead,
);
conversationRoute.patch(
  '/:id/archive',
  validate(conversationIdSchema),
  controller.archive,
);
