import { useEffect, useRef, useState } from 'react';
import { getChatSocket } from '../services/chat-socket';
import type { ConversationMessage, ConversationType, OfferPayload } from '../services/messaging-api';

export interface ConversationUpdatedPayload {
  id: string;
  type?: ConversationType;
  orderId?: string | null;
  lastMessage?: ConversationMessage;
}

interface ChatSocketHandlers {
  conversationId: string | null;
  onMessage: (message: ConversationMessage) => void;
  onOfferNew: (offer: OfferPayload) => void;
  onOfferUpdated: (offer: OfferPayload) => void;
  onRead: (payload: { conversationId: string; readerId: string }) => void;
  onTyping: (payload: { conversationId: string; userId: string }) => void;
  onTypingStop: (payload: { conversationId: string; userId: string }) => void;
  onConversationUpdated: (payload: ConversationUpdatedPayload) => void;
}

export function useChatSocket({
  conversationId,
  onMessage,
  onOfferNew,
  onOfferUpdated,
  onRead,
  onTyping,
  onTypingStop,
  onConversationUpdated,
}: ChatSocketHandlers) {
  const [connected, setConnected] = useState(false);
  const joinedRef = useRef<string | null>(null);
  const socket = getChatSocket();

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      if (conversationId) {
        socket.emit('conversation:join', conversationId);
        joinedRef.current = conversationId;
      }
    };
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:new', onMessage);
    socket.on('offer:new', onOfferNew);
    socket.on('offer:updated', onOfferUpdated);
    socket.on('message:read', onRead);
    socket.on('typing:start', onTyping);
    socket.on('typing:stop', onTypingStop);
    socket.on('conversation:updated', onConversationUpdated);
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:new', onMessage);
      socket.off('offer:new', onOfferNew);
      socket.off('offer:updated', onOfferUpdated);
      socket.off('message:read', onRead);
      socket.off('typing:start', onTyping);
      socket.off('typing:stop', onTypingStop);
      socket.off('conversation:updated', onConversationUpdated);
    };
  }, [
    conversationId,
    onConversationUpdated,
    onMessage,
    onOfferNew,
    onOfferUpdated,
    onRead,
    onTyping,
    onTypingStop,
    socket,
  ]);

  useEffect(() => {
    const previous = joinedRef.current;
    if (previous && previous !== conversationId) socket.emit('conversation:leave', previous);
    if (conversationId && previous !== conversationId && socket.connected) {
      socket.emit('conversation:join', conversationId);
      joinedRef.current = conversationId;
    }
    if (!conversationId) joinedRef.current = null;
  }, [conversationId, socket]);

  const startTyping = () => {
    if (conversationId && socket.connected) socket.emit('typing:start', conversationId);
  };
  const stopTyping = () => {
    if (conversationId && socket.connected) socket.emit('typing:stop', conversationId);
  };

  return { connected, startTyping, stopTyping };
}
