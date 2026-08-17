import { io, type Socket } from 'socket.io-client';
import { env } from '@/config/env';

let socket: Socket | null = null;

const socketOrigin = () => {
  if (env.apiBaseUrl.startsWith('http')) return env.apiBaseUrl.replace(/\/api\/v\d+\/?$/, '');
  return window.location.origin;
};

export function getChatSocket() {
  if (!socket) {
    socket = io(socketOrigin(), {
      path: '/socket.io/',
      withCredentials: true,
      autoConnect: false,
    });
  }
  return socket;
}
