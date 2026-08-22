import { useCallback, useEffect, useRef, useState } from "react";
import { getChatSocket } from "../services/chat-socket";
import type {
  ConversationMessage,
  ConversationType,
  OfferPayload,
} from "../services/messaging-api";

export interface ConversationUpdatedPayload {
  id: string;
  type?: ConversationType;
  orderId?: string | null;
  lastMessage?: ConversationMessage;
}

interface ChatSocketHandlers {
  conversationId: string | null;
  conversationIds: string[];
  onMessage: (message: ConversationMessage) => void;
  onOfferNew: (offer: OfferPayload) => void;
  onOfferUpdated: (offer: OfferPayload) => void;
  onReplacementUpdated: (payload: {
    conversationId: string;
    replacementId: string;
    messageId: string;
  }) => void;
  onRead: (payload: { conversationId: string; readerId: string }) => void;
  onTyping: (payload: { conversationId: string; userId: string }) => void;
  onTypingStop: (payload: { conversationId: string; userId: string }) => void;
  onConversationUpdated: (payload: ConversationUpdatedPayload) => void;
}

export function useChatSocket({
  conversationId,
  conversationIds,
  onMessage,
  onOfferNew,
  onOfferUpdated,
  onReplacementUpdated,
  onRead,
  onTyping,
  onTypingStop,
  onConversationUpdated,
}: ChatSocketHandlers) {
  const [connected, setConnected] = useState(false);
  const joinedRef = useRef<Set<string>>(new Set());
  const desiredRef = useRef<Set<string>>(new Set());
  const handlersRef = useRef({
    onMessage,
    onOfferNew,
    onOfferUpdated,
    onReplacementUpdated,
    onRead,
    onTyping,
    onTypingStop,
    onConversationUpdated,
  });
  const socket = getChatSocket();

  const syncRooms = useCallback(() => {
    for (const previous of joinedRef.current) {
      if (!desiredRef.current.has(previous)) {
        socket.emit("conversation:leave", previous);
        joinedRef.current.delete(previous);
      }
    }

    if (!socket.connected) return;

    for (const id of desiredRef.current) {
      if (!joinedRef.current.has(id)) {
        socket.emit("conversation:join", id, (ack?: { ok: boolean }) => {
          if (ack?.ok) joinedRef.current.add(id);
        });
      }
    }
  }, [socket]);

  useEffect(() => {
    handlersRef.current = {
      onMessage,
      onOfferNew,
      onOfferUpdated,
      onReplacementUpdated,
      onRead,
      onTyping,
      onTypingStop,
      onConversationUpdated,
    };
  }, [
    onConversationUpdated,
    onMessage,
    onOfferNew,
    onOfferUpdated,
    onRead,
    onReplacementUpdated,
    onTyping,
    onTypingStop,
  ]);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      syncRooms();
    };
    const onDisconnect = () => setConnected(false);
    const handleMessage = (message: ConversationMessage) =>
      handlersRef.current.onMessage(message);
    const handleOfferNew = (offer: OfferPayload) =>
      handlersRef.current.onOfferNew(offer);
    const handleOfferUpdated = (offer: OfferPayload) =>
      handlersRef.current.onOfferUpdated(offer);
    const handleReplacementUpdated = (payload: {
      conversationId: string;
      replacementId: string;
      messageId: string;
    }) => handlersRef.current.onReplacementUpdated(payload);
    const handleRead = (payload: {
      conversationId: string;
      readerId: string;
    }) => handlersRef.current.onRead(payload);
    const handleTyping = (payload: {
      conversationId: string;
      userId: string;
    }) => handlersRef.current.onTyping(payload);
    const handleTypingStop = (payload: {
      conversationId: string;
      userId: string;
    }) => handlersRef.current.onTypingStop(payload);
    const handleConversationUpdated = (payload: ConversationUpdatedPayload) =>
      handlersRef.current.onConversationUpdated(payload);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("message:new", handleMessage);
    socket.on("offer:new", handleOfferNew);
    socket.on("offer:updated", handleOfferUpdated);
    socket.on("replacement:updated", handleReplacementUpdated);
    socket.on("message:read", handleRead);
    socket.on("typing:start", handleTyping);
    socket.on("typing:stop", handleTypingStop);
    socket.on("conversation:updated", handleConversationUpdated);
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("message:new", handleMessage);
      socket.off("offer:new", handleOfferNew);
      socket.off("offer:updated", handleOfferUpdated);
      socket.off("replacement:updated", handleReplacementUpdated);
      socket.off("message:read", handleRead);
      socket.off("typing:start", handleTyping);
      socket.off("typing:stop", handleTypingStop);
      socket.off("conversation:updated", handleConversationUpdated);
    };
  }, [socket, syncRooms]);

  useEffect(() => {
    const desired = new Set(conversationIds);
    if (conversationId) desired.add(conversationId);
    desiredRef.current = desired;
    syncRooms();
  }, [conversationId, conversationIds, socket, syncRooms]);

  const startTyping = () => {
    if (conversationId && socket.connected)
      socket.emit("typing:start", conversationId);
  };
  const stopTyping = () => {
    if (conversationId && socket.connected)
      socket.emit("typing:stop", conversationId);
  };

  return { connected, startTyping, stopTyping };
}
