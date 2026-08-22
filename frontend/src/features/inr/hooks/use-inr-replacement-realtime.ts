import { useEffect } from "react";
import { getChatSocket } from "@/features/messages/services/chat-socket";

export function useInrReplacementRealtime(
  conversationId: string | null | undefined,
  onRefresh: () => void,
) {
  useEffect(() => {
    if (!conversationId) return undefined;
    const socket = getChatSocket();
    const join = () => socket.emit("conversation:join", conversationId);
    const handleReplacementUpdated = (payload: { conversationId: string }) => {
      if (payload.conversationId === conversationId) onRefresh();
    };
    const handleMessage = (message: {
      conversationId: string;
      type?: string;
      replacement?: unknown;
    }) => {
      if (
        message.conversationId === conversationId &&
        (message.type === "REPLACEMENT" || message.replacement)
      )
        onRefresh();
    };

    socket.on("connect", join);
    socket.on("replacement:updated", handleReplacementUpdated);
    socket.on("message:new", handleMessage);
    socket.connect();
    if (socket.connected) join();

    return () => {
      socket.emit("conversation:leave", conversationId);
      socket.off("connect", join);
      socket.off("replacement:updated", handleReplacementUpdated);
      socket.off("message:new", handleMessage);
    };
  }, [conversationId, onRefresh]);
}
