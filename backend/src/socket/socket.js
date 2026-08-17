import { Server } from 'socket.io';
import cookie from 'cookie';
import { env } from '../config/env.js';
import { verifyAccess } from '../common/utils/token.js';
import * as userService from '../modules/users/service.js';
import { USER_STATUS } from '../common/constants/user-status.js';
import * as conversationService from '../modules/conversations/conversation.service.js';

let io;

const room = (conversationId) => `conversation:${conversationId}`;

export const emitToConversation = (conversationId, event, payload) => {
  if (!io) return;
  io.to(room(conversationId)).emit(event, payload);
};

const authenticateSocket = async (socket, next) => {
  try {
    const cookies = cookie.parse(socket.handshake.headers.cookie || '');
    const token = socket.handshake.auth?.token || cookies.accessToken;
    if (!token) return next(new Error('Authentication required'));
    const payload = verifyAccess(token);
    if (payload.type !== 'access') return next(new Error('Invalid token'));
    const user = await userService.getAuthenticatedUser(payload.sub);
    if (!user || user.status !== USER_STATUS.ACTIVE)
      return next(new Error('Authentication required'));
    socket.user = { id: String(user.id), role: user.role };
    next();
  } catch {
    next(new Error('Authentication required'));
  }
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: env.CLIENT_ORIGIN.split(','),
      credentials: true,
    },
  });
  io.use(authenticateSocket);
  io.on('connection', (socket) => {
    socket.on('conversation:join', async (conversationId, ack) => {
      try {
        await conversationService.assertParticipant(conversationId, socket.user.id);
        socket.join(room(conversationId));
        ack?.({ ok: true, conversationId });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });
    socket.on('conversation:leave', (conversationId, ack) => {
      socket.leave(room(conversationId));
      ack?.({ ok: true, conversationId });
    });
    socket.on('typing:start', async (conversationId) => {
      try {
        await conversationService.assertParticipant(conversationId, socket.user.id);
        socket.to(room(conversationId)).emit('typing:start', {
          conversationId,
          userId: socket.user.id,
        });
      } catch {
        // Authorization failures are intentionally silent for typing events.
      }
    });
    socket.on('typing:stop', async (conversationId) => {
      try {
        await conversationService.assertParticipant(conversationId, socket.user.id);
        socket.to(room(conversationId)).emit('typing:stop', {
          conversationId,
          userId: socket.user.id,
        });
      } catch {
        // Authorization failures are intentionally silent for typing events.
      }
    });
  });
  return io;
};
