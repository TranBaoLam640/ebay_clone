import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { Price } from "@/components/price";
import { Skeleton } from "@/components/skeleton";
import { Textarea } from "@/components/textarea";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { messageFromError } from "@/features/auth/utils/auth-errors";
import { useToast } from "@/contexts/toast-context";
import { cartApi } from "@/features/cart/services/cart-api";
import { paths } from "@/routes/paths";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/format-date";
import { useChatSocket } from "../hooks/use-chat-socket";
import type { ConversationUpdatedPayload } from "../hooks/use-chat-socket";
import {
  messagingApi,
  type ConversationMessage,
  type ConversationSummary,
  type MessageAttachment,
  type OfferPayload,
  type ReplacementAction,
  type ReplacementPayload,
} from "../services/messaging-api";

const PAGE_SIZE = 30;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function compareMessages(
  left: ConversationMessage,
  right: ConversationMessage,
) {
  const byTime =
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  return byTime || left.id.localeCompare(right.id);
}

function normalizeId(value: string | null | undefined) {
  return value ? String(value) : "";
}

function isOwnMessage(
  message: ConversationMessage,
  currentUserId: string | null | undefined,
) {
  return normalizeId(message.senderId) === normalizeId(currentUserId);
}

function sameSender(
  left: ConversationMessage | undefined,
  right: ConversationMessage,
) {
  return !!left && normalizeId(left.senderId) === normalizeId(right.senderId);
}

function formatMessageTime(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

interface LocalAttachment {
  id: string;
  file: File;
  previewUrl: string | null;
  type: "IMAGE" | "FILE";
}

export default function MessagesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const selectedId = search.get("conversation");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [hasOlder, setHasOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
  const [pendingReplacementId, setPendingReplacementId] = useState<
    string | null
  >(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);
  const isNearBottom = useCallback(() => {
    const box = scrollRef.current;
    if (!box) return true;
    return box.scrollHeight - box.scrollTop - box.clientHeight < 96;
  }, []);
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior,
      });
    });
  }, []);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => messagingApi.conversations({ limit: 50 }),
  });
  const selected =
    conversations.data?.find((item) => item.id === selectedId) ?? null;
  const currentUserId = user?.id ?? user?._id ?? null;
  const conversationIds = useMemo(
    () => conversations.data?.map((conversation) => conversation.id) ?? [],
    [conversations.data],
  );

  const selectConversation = (id: string | null) => {
    setSearch(id ? { conversation: id } : {});
  };

  const mergeMessage = useCallback((incoming: ConversationMessage) => {
    setMessages((current) => {
      if (current.some((message) => message.id === incoming.id)) return current;
      const withoutTemp = current.filter(
        (message) =>
          !(
            (incoming.clientMessageId &&
              message.clientMessageId === incoming.clientMessageId) ||
            (message.localStatus === "sending" &&
              message.content === incoming.content &&
              message.senderId === incoming.senderId)
          ),
      );
      const canonical: ConversationMessage = {
        ...incoming,
        localStatus: "sent",
      };
      return [...withoutTemp, canonical].sort(compareMessages);
    });
  }, []);

  const updateOfferInMessages = useCallback((offer: OfferPayload) => {
    setMessages((current) =>
      current.map((message) =>
        message.offer?.id === offer.id ? { ...message, offer } : message,
      ),
    );
  }, []);

  const updateReplacementInMessages = useCallback(
    (replacement: ReplacementPayload) => {
      setMessages((current) =>
        current.map((message) =>
          message.replacement?.id === replacement.id
            ? { ...message, replacement }
            : message,
        ),
      );
    },
    [],
  );

  const refreshSelectedMessages = useCallback(() => {
    if (!selectedId) return Promise.resolve();
    return messagingApi
      .messages(selectedId, { limit: PAGE_SIZE })
      .then((items) => {
        setMessages((current) => {
          const latest = new Map(
            current.map((message) => [message.id, message]),
          );
          for (const item of items) latest.set(item.id, item);
          return [...latest.values()].sort(compareMessages);
        });
      });
  }, [selectedId]);

  const updateConversationFromMessage = useCallback(
    (message: ConversationMessage) => {
      qc.setQueryData<ConversationSummary[]>(["conversations"], (current) => {
        if (!current) return current;
        const updated = current.map((conversation) =>
          conversation.id === message.conversationId
            ? {
                ...conversation,
                lastMessage: {
                  id: message.id,
                  type: message.type,
                  content: message.content,
                  status: message.status,
                  createdAt: message.createdAt,
                },
                lastMessageAt: message.createdAt,
                unreadCount:
                  message.conversationId === selectedId ||
                  normalizeId(message.senderId) === normalizeId(currentUserId)
                    ? conversation.unreadCount
                    : conversation.unreadCount + 1,
              }
            : conversation,
        );
        return updated.sort(
          (left, right) =>
            new Date(right.lastMessageAt).getTime() -
            new Date(left.lastMessageAt).getTime(),
        );
      });
    },
    [currentUserId, qc, selectedId],
  );

  const mergeConversationUpdate = useCallback(
    (payload: ConversationUpdatedPayload) => {
      qc.setQueryData<ConversationSummary[]>(["conversations"], (current) =>
        current
          ?.map((conversation) =>
            conversation.id === payload.id
              ? {
                  ...conversation,
                  ...(payload.type && { type: payload.type }),
                  ...(payload.orderId !== undefined && {
                    orderId: payload.orderId,
                  }),
                  ...(payload.lastMessage && {
                    lastMessage: payload.lastMessage,
                  }),
                }
              : conversation,
          )
          .sort(
            (left, right) =>
              new Date(right.lastMessageAt).getTime() -
              new Date(left.lastMessageAt).getTime(),
          ),
      );
    },
    [qc],
  );

  const socket = useChatSocket({
    conversationId: selectedId,
    conversationIds,
    onMessage: useCallback(
      (message) => {
        const shouldScroll =
          message.conversationId === selectedId && isNearBottom();
        if (message.conversationId === selectedId) {
          mergeMessage(message);
          if (message.type === "REPLACEMENT") void refreshSelectedMessages();
          if (shouldScroll) scrollToBottom("smooth");
        }
        updateConversationFromMessage(message);
      },
      [
        isNearBottom,
        mergeMessage,
        scrollToBottom,
        selectedId,
        updateConversationFromMessage,
        refreshSelectedMessages,
      ],
    ),
    onOfferNew: useCallback(
      (offer) => {
        if (offer.conversationId === selectedId) {
          setMessages((current) =>
            current.map((message) =>
              message.offer?.id === offer.id ? { ...message, offer } : message,
            ),
          );
        }
      },
      [selectedId],
    ),
    onOfferUpdated: useCallback(
      (offer) => {
        updateOfferInMessages(offer);
      },
      [updateOfferInMessages],
    ),
    onReplacementUpdated: useCallback(
      (payload) => {
        if (payload.conversationId === selectedId)
          void refreshSelectedMessages();
      },
      [refreshSelectedMessages, selectedId],
    ),
    onRead: useCallback(
      (payload) => {
        if (payload.conversationId === selectedId) {
          setMessages((current) =>
            current.map((message) =>
              normalizeId(message.senderId) === normalizeId(currentUserId)
                ? { ...message, status: "READ" }
                : message,
            ),
          );
        }
      },
      [currentUserId, selectedId],
    ),
    onTyping: useCallback(
      (payload) => {
        if (
          payload.conversationId === selectedId &&
          normalizeId(payload.userId) !== normalizeId(currentUserId)
        ) {
          setTypingUser(payload.userId);
        }
      },
      [currentUserId, selectedId],
    ),
    onTypingStop: useCallback(
      (payload) => {
        if (payload.conversationId === selectedId) setTypingUser(null);
      },
      [selectedId],
    ),
    onConversationUpdated: useCallback(
      (payload) => {
        mergeConversationUpdate(payload);
      },
      [mergeConversationUpdate],
    ),
  });

  useEffect(() => {
    if (!selectedId) return;
    setMessages([]);
    setHasOlder(true);
    messagingApi
      .messages(selectedId, { limit: PAGE_SIZE })
      .then((items) => {
        setMessages(items);
        setHasOlder(items.length === PAGE_SIZE);
        requestAnimationFrame(() => {
          if (scrollRef.current)
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        });
        return messagingApi.markRead(selectedId);
      })
      .then(() => {
        qc.setQueryData<ConversationSummary[]>(["conversations"], (current) =>
          current?.map((conversation) =>
            conversation.id === selectedId
              ? { ...conversation, unreadCount: 0 }
              : conversation,
          ),
        );
      })
      .catch((err) => notify(messageFromError(err), "error"));
  }, [notify, qc, selectedId]);

  useEffect(() => {
    if (socket.connected && selectedId) {
      messagingApi.messages(selectedId, { limit: PAGE_SIZE }).then((items) => {
        setMessages((current) => {
          const existing = new Set(current.map((message) => message.id));
          return [
            ...current,
            ...items.filter((message) => !existing.has(message.id)),
          ].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        });
      });
    }
  }, [selectedId, socket.connected]);

  const loadOlder = async () => {
    if (!selectedId || !hasOlder || loadingOlder || messages.length === 0)
      return;
    const box = scrollRef.current;
    const previousHeight = box?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const older = await messagingApi.messages(selectedId, {
        limit: PAGE_SIZE,
        before: messages[0].id,
      });
      setHasOlder(older.length === PAGE_SIZE);
      setMessages((current) => {
        const existing = new Set(current.map((message) => message.id));
        return [
          ...older.filter((message) => !existing.has(message.id)),
          ...current,
        ];
      });
      requestAnimationFrame(() => {
        if (box) box.scrollTop = box.scrollHeight - previousHeight;
      });
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = useMutation({
    mutationFn: async ({
      content,
      sendCopyToEmail,
      clientMessageId,
      attachments,
    }: {
      content: string;
      sendCopyToEmail: boolean;
      clientMessageId: string;
      attachments: LocalAttachment[];
      restoreDraft?: () => void;
    }) => {
      if (!selectedId) throw new Error("No conversation selected");
      const uploaded = attachments.length
        ? await messagingApi.uploadAttachments(
            selectedId,
            attachments.map((attachment) => attachment.file),
          )
        : [];
      return {
        clientMessageId,
        saved: await messagingApi.sendMessage(selectedId, {
          type: messageTypeFor(uploaded),
          clientMessageId,
          content,
          attachments: uploaded,
          sendCopyToEmail,
        }),
      };
    },
    onMutate: ({ clientMessageId }) => {
      setMessages((current) =>
        current.map((message) =>
          message.clientMessageId === clientMessageId
            ? { ...message, localStatus: "sending" }
            : message,
        ),
      );
    },
    onSuccess: ({ clientMessageId, saved }) => {
      setMessages((current) =>
        current
          .map((message) =>
            message.clientMessageId === clientMessageId
              ? ({
                  ...saved,
                  clientMessageId,
                  localStatus: "sent",
                } satisfies ConversationMessage)
              : message,
          )
          .sort(compareMessages),
      );
      updateConversationFromMessage(saved);
    },
    onError: (_err, variables) => {
      setMessages((current) =>
        current.map((message) =>
          message.clientMessageId === variables.clientMessageId
            ? { ...message, localStatus: "failed" }
            : message,
        ),
      );
      variables.restoreDraft?.();
    },
  });

  const offerAction = useMutation({
    mutationFn: (action: {
      kind: "make" | "accept" | "decline" | "counter" | "retract";
      offerId?: string;
      price?: number;
      quantity?: number;
    }) => {
      if (action.kind === "accept")
        return messagingApi.acceptOffer(action.offerId!);
      if (action.kind === "decline")
        return messagingApi.declineOffer(action.offerId!);
      if (action.kind === "retract")
        return messagingApi.retractOffer(action.offerId!);
      if (action.kind === "counter") {
        return messagingApi.counterOffer(action.offerId!, {
          price: action.price!,
          quantity: action.quantity,
        });
      }
      return messagingApi.createOffer(selectedId!, {
        price: action.price!,
        quantity: action.quantity,
      });
    },
    onMutate: (action) => {
      setPendingOfferId(action.offerId ?? "new");
    },
    onSuccess: (offer, action) => {
      updateOfferInMessages(offer);
      if (selectedId && (action.kind === "make" || action.kind === "counter")) {
        messagingApi
          .messages(selectedId, { limit: PAGE_SIZE })
          .then((items) => {
            setMessages((current) => {
              const existing = new Set(current.map((message) => message.id));
              return [
                ...current,
                ...items.filter((message) => !existing.has(message.id)),
              ].sort(compareMessages);
            });
          });
      }
    },
    onError: (err) => {
      notify(messageFromError(err), "error");
      if (selectedId) {
        messagingApi
          .messages(selectedId, { limit: PAGE_SIZE })
          .then((items) => {
            setMessages((current) => {
              const existing = new Set(current.map((message) => message.id));
              return [
                ...current,
                ...items.filter((message) => !existing.has(message.id)),
              ].sort(compareMessages);
            });
          });
      }
    },
    onSettled: () => setPendingOfferId(null),
  });

  const replacementAction = useMutation({
    mutationFn: (action: {
      kind: ReplacementAction;
      replacementId: string;
      requestId: string;
    }) => {
      if (action.kind === "ACCEPT")
        return messagingApi.acceptReplacement(action.replacementId);
      if (action.kind === "DECLINE")
        return messagingApi.declineReplacement(action.replacementId);
      return messagingApi
        .refundInstead(action.requestId)
        .then(() => refreshSelectedMessages())
        .then(() => null);
    },
    onMutate: (action) => setPendingReplacementId(action.replacementId),
    onSuccess: (replacement) => {
      if (replacement) updateReplacementInMessages(replacement);
    },
    onError: (err) => {
      notify(messageFromError(err), "error");
      void refreshSelectedMessages();
    },
    onSettled: () => setPendingReplacementId(null),
  });

  const handleScroll = () => {
    if (scrollRef.current && scrollRef.current.scrollTop < 80) loadOlder();
  };

  const selectedMessages = useMemo(() => messages, [messages]);
  const hasBlockingOffer = selectedMessages.some(
    (message) =>
      message.offer?.conversationId === selectedId &&
      (message.offer.status === "PENDING" ||
        message.offer.status === "ACCEPTED"),
  );
  const listingEligibleForOffer =
    selected?.product.offersEnabled === true &&
    selected.product.status === "ACTIVE" &&
    (selected.product.stock ?? 0) > 0 &&
    (selected.product.listingType ?? "FIXED") === "FIXED";
  const canMakeOffer =
    selected?.role === "BUYER" && listingEligibleForOffer && !hasBlockingOffer;

  return (
    <div className="mx-auto flex h-[calc(100vh-112px)] max-w-[1180px] flex-col px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text">Messages</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                socket.connected ? "bg-success" : "bg-warning",
              )}
            />
            {socket.connected ? "Realtime connected" : "Realtime reconnecting"}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)]">
          <aside
            className={cn(
              "min-h-0 border-border bg-surface md:border-r",
              selectedId && "hidden md:block",
            )}
          >
            <div className="border-b border-border px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Inbox
              </p>
            </div>
            {conversations.isLoading ? (
              <ConversationSkeleton />
            ) : conversations.data?.length ? (
              <div className="h-full overflow-y-auto">
                {conversations.data.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    active={conversation.id === selectedId}
                    onClick={() => selectConversation(conversation.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon="icon-mail"
                  title="No messages yet"
                  description="Contact a seller from a listing to start a conversation."
                />
              </div>
            )}
          </aside>

          <main className={cn("min-h-0", !selectedId && "hidden md:block")}>
            {selected ? (
              <div className="flex h-full min-h-0 flex-col">
                <ChatHeader
                  conversation={selected}
                  onBack={() => selectConversation(null)}
                />
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="min-h-0 flex-1 overflow-y-auto bg-surface-2/30 px-4 py-5 sm:px-6"
                >
                  {loadingOlder && (
                    <p className="pb-2 text-center text-xs text-muted">
                      Loading older messages...
                    </p>
                  )}
                  {selectedMessages.length === 0 ? (
                    <EmptyState
                      icon="icon-mail"
                      title="No messages yet"
                      description="Send the first message in this listing conversation."
                    />
                  ) : (
                    <div className="flex flex-col gap-3">
                      {selectedMessages.map((message, index) => {
                        const own = isOwnMessage(message, currentUserId);
                        const compactWithPrevious = sameSender(
                          selectedMessages[index - 1],
                          message,
                        );
                        return (
                          <MessageBubble
                            key={message.clientMessageId ?? message.id}
                            message={message}
                            own={own}
                            compactWithPrevious={compactWithPrevious}
                            senderLabel={messageSenderLabel(
                              message,
                              selected,
                              own,
                            )}
                            conversation={selected}
                            offerLoading={pendingOfferId === message.offer?.id}
                            replacementLoading={
                              pendingReplacementId === message.replacement?.id
                            }
                            onRetry={() => {
                              if (!message.content || !message.clientMessageId)
                                return;
                              send.mutate({
                                content: message.content,
                                sendCopyToEmail: false,
                                clientMessageId: message.clientMessageId,
                                attachments: [],
                                restoreDraft: undefined,
                              });
                            }}
                            onOfferAction={(action) =>
                              offerAction.mutate(action)
                            }
                            onReplacementAction={(action) =>
                              replacementAction.mutate(action)
                            }
                            onBuyOffer={async (offer) => {
                              try {
                                const quantity = offer.quantity ?? 1;
                                const cart = await cartApi.get();
                                const existing = cart.items.find(
                                  (item) =>
                                    item.productId === selected.product.id,
                                );
                                if (existing) {
                                  await cartApi.setQuantity(
                                    selected.product.id,
                                    quantity,
                                  );
                                } else {
                                  await cartApi.addItem(
                                    selected.product.id,
                                    quantity,
                                  );
                                }
                                qc.invalidateQueries({ queryKey: ["cart"] });
                                navigate(
                                  `${paths.checkout}?offerId=${offer.id}&productId=${selected.product.id}`,
                                );
                              } catch (err) {
                                notify(messageFromError(err), "error");
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                  {typingUser && (
                    <p className="mt-3 text-sm text-muted">
                      {conversationParticipant(selected).displayName} is
                      typing...
                    </p>
                  )}
                </div>
                <Composer
                  disabled={!selectedId}
                  onTyping={() => {
                    socket.startTyping();
                    if (typingTimer.current)
                      window.clearTimeout(typingTimer.current);
                    typingTimer.current = window.setTimeout(
                      socket.stopTyping,
                      1200,
                    );
                  }}
                  onSend={(
                    content,
                    sendCopyToEmail,
                    attachments,
                    restoreDraft,
                  ) => {
                    const clientMessageId = crypto.randomUUID();
                    const optimisticAttachments = attachments.map(
                      (attachment) => ({
                        url: attachment.previewUrl || "",
                        fileName: attachment.file.name,
                        mimeType: attachment.file.type,
                        size: attachment.file.size,
                        type: attachment.type,
                      }),
                    );
                    const optimistic: ConversationMessage = {
                      id: clientMessageId,
                      clientMessageId,
                      conversationId: selected.id,
                      senderId: currentUserId!,
                      sender: {
                        id: currentUserId!,
                        displayName: user!.fullName,
                        username: user!.email.split("@")[0],
                        avatarUrl: user!.avatarUrl,
                      },
                      type: messageTypeFor(optimisticAttachments),
                      content,
                      attachments: optimisticAttachments,
                      status: "SENT",
                      localStatus: "sending",
                      createdAt: new Date().toISOString(),
                    };
                    setMessages((current) => [...current, optimistic]);
                    scrollToBottom();
                    send.mutate({
                      content,
                      sendCopyToEmail,
                      clientMessageId,
                      attachments,
                      restoreDraft,
                    });
                  }}
                  sending={send.isPending}
                  canOffer={canMakeOffer}
                  productStock={selected.product.stock ?? 1}
                  productPrice={selected.product.price}
                  onMakeOffer={(price, quantity) =>
                    offerAction.mutate({ kind: "make", price, quantity })
                  }
                  offerLoading={offerAction.isPending}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <EmptyState
                  icon="icon-mail"
                  title="Select a conversation"
                  description="Choose a listing conversation to view messages."
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function messageTypeFor(
  attachments: Pick<MessageAttachment, "type" | "mimeType">[],
) {
  if (attachments.length === 0) return "TEXT";
  return attachments.some(
    (attachment) =>
      attachment.type === "FILE" || !attachment.mimeType.startsWith("image/"),
  )
    ? "FILE"
    : "IMAGE";
}

function conversationParticipant(conversation: ConversationSummary) {
  if (conversation.role === "SELLER" && conversation.buyer)
    return conversation.buyer;
  const emailUsername = conversation.seller.email?.split("@")[0];
  return {
    ...conversation.seller,
    displayName:
      conversation.seller.username ||
      emailUsername ||
      conversation.seller.displayName ||
      "Seller",
  };
}

function messageSenderLabel(
  message: ConversationMessage,
  conversation: ConversationSummary,
  own: boolean,
) {
  if (own) return "You";
  if (message.sender?.displayName) return message.sender.displayName;
  if (message.sender?.username) return message.sender.username;
  if (normalizeId(message.senderId) === normalizeId(conversation.buyer?.id)) {
    return conversation.buyer?.displayName || "Buyer";
  }
  return conversationParticipant(conversation).displayName;
}

function ConversationRow({
  conversation,
  active,
  onClick,
}: {
  conversation: ConversationSummary;
  active: boolean;
  onClick: () => void;
}) {
  const preview =
    conversation.lastMessage?.type === "OFFER"
      ? "Offer update"
      : conversation.lastMessage?.content || "No messages yet";
  const participant = conversationParticipant(conversation);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-surface-2/70",
        active && "bg-surface-2 shadow-[inset_3px_0_0_var(--color-primary)]",
      )}
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
        {conversation.product.image ? (
          <img
            src={conversation.product.image}
            alt={conversation.product.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <Icon variant="icon-package" size={22} className="m-3 text-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-text">
            {participant.displayName}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-on-accent">
              {conversation.unreadCount}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-text/90">
          {conversation.product.title}
        </p>
        <p className="mt-1 truncate text-xs text-muted">{preview}</p>
        <p className="mt-1.5 text-xs text-muted">
          {formatDate(conversation.lastMessageAt)}
        </p>
      </div>
    </button>
  );
}

function ChatHeader({
  conversation,
  onBack,
}: {
  conversation: ConversationSummary;
  onBack: () => void;
}) {
  const participant = conversationParticipant(conversation);
  return (
    <header className="border-b border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-2 hover:bg-surface-2 md:hidden"
          aria-label="Back"
        >
          <Icon variant="icon-arrow-left" size={18} />
        </button>
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
          {conversation.product.image ? (
            <img
              src={conversation.product.image}
              alt={conversation.product.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <Icon variant="icon-package" size={24} className="m-4 text-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to={paths.product(conversation.product.id)}
            className="block truncate font-semibold text-text hover:text-primary"
          >
            {conversation.product.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Price cents={conversation.product.price} />
            <span>{participant.displayName}</span>
            {conversation.orderId && (
              <span>Order #{conversation.orderId.slice(-8).toUpperCase()}</span>
            )}
          </div>
        </div>
        <Link
          to={paths.product(conversation.product.id)}
          className="hidden sm:block"
        >
          <Button variant="secondary" size="sm">
            View Listing
          </Button>
        </Link>
        {conversation.orderId && (
          <Link
            to={paths.order(conversation.orderId)}
            className="hidden sm:block"
          >
            <Button variant="secondary" size="sm">
              View Order
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}

function MessageBubble({
  message,
  own,
  compactWithPrevious,
  senderLabel,
  conversation,
  offerLoading,
  replacementLoading,
  onRetry,
  onOfferAction,
  onReplacementAction,
  onBuyOffer,
}: {
  message: ConversationMessage;
  own: boolean;
  compactWithPrevious: boolean;
  senderLabel: string;
  conversation: ConversationSummary;
  offerLoading: boolean;
  replacementLoading: boolean;
  onRetry: () => void;
  onOfferAction: (action: {
    kind: "accept" | "decline" | "counter" | "retract";
    offerId: string;
    price?: number;
    quantity?: number;
  }) => void;
  onReplacementAction: (action: {
    kind: ReplacementAction;
    replacementId: string;
    requestId: string;
  }) => void;
  onBuyOffer: (offer: OfferPayload) => void;
}) {
  const metaText =
    message.localStatus === "sending"
      ? "Sending..."
      : message.localStatus === "failed"
        ? "Failed"
        : message.status === "READ"
          ? "Read"
          : "Sent";
  return (
    <div
      className={cn(
        "flex w-full flex-col",
        own ? "items-end" : "items-start",
        compactWithPrevious ? "mt-[-0.25rem]" : "mt-2",
      )}
    >
      {!compactWithPrevious && (
        <p
          className={cn(
            "mb-1 px-1 text-xs font-semibold text-muted",
            own ? "text-right" : "text-left",
          )}
        >
          {senderLabel}
        </p>
      )}
      {message.type === "OFFER" && message.offer ? (
        <OfferCard
          offer={message.offer}
          conversation={conversation}
          own={own}
          loading={offerLoading}
          onAction={onOfferAction}
          onBuy={onBuyOffer}
        />
      ) : message.type === "REPLACEMENT" && message.replacement ? (
        <ReplacementCard
          replacement={message.replacement}
          conversation={conversation}
          own={own}
          loading={replacementLoading}
          onAction={onReplacementAction}
        />
      ) : (
        <div
          className={cn(
            "max-w-[85%] overflow-hidden rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm sm:max-w-[72%]",
            own
              ? "rounded-br-md bg-primary text-white"
              : "rounded-bl-md border border-border bg-surface text-text",
          )}
        >
          {message.content && (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}
          {message.attachments.length > 0 && (
            <AttachmentList attachments={message.attachments} own={own} />
          )}
          {message.type === "SYSTEM" ? (
            <p className="text-muted">{message.content}</p>
          ) : null}
          <div
            className={cn(
              "mt-1.5 flex items-center gap-2 text-[11px]",
              own ? "justify-end text-white/75" : "justify-start text-muted",
            )}
          >
            <span>
              {formatMessageTime(message.createdAt)}
              {own ? ` ${metaText}` : ""}
            </span>
            {message.localStatus === "failed" && (
              <button
                type="button"
                onClick={onRetry}
                className="font-semibold underline"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AttachmentList({
  attachments,
  own,
}: {
  attachments: MessageAttachment[];
  own: boolean;
}) {
  const [preview, setPreview] = useState<MessageAttachment | null>(null);
  return (
    <>
      <div className="mt-2 flex max-w-full flex-wrap gap-2">
        {attachments.map((attachment, index) =>
          attachment.type === "IMAGE" ||
          attachment.mimeType.startsWith("image/") ? (
            <button
              key={`${attachment.url}-${index}`}
              type="button"
              onClick={() => attachment.url && setPreview(attachment)}
              className={cn(
                "overflow-hidden rounded-lg border",
                own
                  ? "border-white/20 bg-white/10"
                  : "border-border bg-surface-2",
              )}
            >
              <img
                src={attachment.url}
                alt={attachment.fileName || "Image attachment"}
                loading="lazy"
                className="h-28 w-28 object-cover sm:h-32 sm:w-32"
              />
            </button>
          ) : (
            <a
              key={`${attachment.url}-${index}`}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex min-w-[220px] max-w-full flex-col gap-1 rounded-lg border p-3",
                own
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-border bg-surface text-text",
              )}
            >
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                <Icon variant="icon-package" size={16} />
                <span className="truncate">
                  {attachment.fileName || "File attachment"}
                </span>
              </span>
              <span
                className={cn("text-xs", own ? "text-white/75" : "text-muted")}
              >
                {fileKind(attachment)} · {formatBytes(attachment.size)}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold",
                  own ? "text-white" : "text-primary",
                )}
              >
                View / Download
              </span>
            </a>
          ),
        )}
      </div>
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.fileName || "Image preview"}
        size="lg"
      >
        {preview && (
          <img
            src={preview.url}
            alt={preview.fileName || "Image attachment"}
            className="max-h-[70vh] w-full object-contain"
          />
        )}
      </Modal>
    </>
  );
}

function fileKind(attachment: MessageAttachment) {
  return (
    attachment.fileName?.split(".").pop() ||
    attachment.mimeType ||
    "file"
  ).toUpperCase();
}

function formatBytes(size?: number) {
  if (!size) return "unknown size";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function ReplacementCard({
  replacement,
  conversation,
  own,
  loading,
  onAction,
}: {
  replacement: ReplacementPayload;
  conversation: ConversationSummary;
  own: boolean;
  loading: boolean;
  onAction: (action: {
    kind: ReplacementAction;
    replacementId: string;
    requestId: string;
  }) => void;
}) {
  const isBuyerView = conversation.role === "BUYER";
  const actorLabel =
    replacement.initiatorRole === "SELLER" ? "Seller" : "Buyer";
  const title =
    replacement.displayState === "PROPOSED"
      ? replacement.initiatorRole === "SELLER"
        ? own
          ? "Replacement offered."
          : "Seller offered a replacement."
        : own
          ? "Replacement requested."
          : "Buyer requested a replacement."
      : replacement.displayState === "REFUND_REQUESTED"
        ? isBuyerView
          ? "You requested a refund instead."
          : "Buyer requested a refund instead."
        : replacement.displayState === "ACCEPTED"
          ? "Replacement accepted."
          : replacement.displayState === "FULFILLING"
            ? replacement.shipment?.status === "DELIVERED"
              ? isBuyerView
                ? "Your replacement was delivered."
                : "Replacement was delivered."
              : replacement.shipment?.status === "IN_TRANSIT"
                ? isBuyerView
                  ? "Your replacement is in transit."
                  : "Replacement is in transit."
                : "Replacement is being prepared for shipment."
            : replacement.displayState === "DECLINED"
              ? "Replacement declined."
              : replacement.displayState === "CANCELLED"
                ? "Replacement cancelled."
                : replacement.displayState === "FAILED"
                  ? "Replacement could not be completed."
                  : "Replacement completed.";
  const detail =
    replacement.displayState === "PROPOSED"
      ? own
        ? `Waiting for ${conversation.role === "BUYER" ? "seller" : "buyer"} response.`
        : "Review the replacement request."
      : replacement.displayState === "ACCEPTED"
        ? replacement.shipment?.status === "READY_FOR_PICKUP"
          ? "The seller is preparing your replacement shipment."
          : "Waiting for the seller to prepare it."
        : null;

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-2xl border p-4 text-sm shadow-sm",
        own
          ? "rounded-br-md border-primary bg-primary text-white"
          : "rounded-bl-md border-border bg-surface text-text",
      )}
    >
      <div className="flex items-start gap-3">
        {replacement.product.image ? (
          <img
            src={replacement.product.image}
            alt={replacement.product.title || "Replacement item"}
            className="h-14 w-14 shrink-0 rounded-md object-cover"
          />
        ) : (
          <span
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-md",
              own ? "bg-white/15" : "bg-surface-2",
            )}
          >
            <Icon variant="icon-refresh" size={22} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold">{title}</p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
                own ? "bg-white/15 text-white" : "bg-surface-2 text-muted",
              )}
            >
              {actorLabel}
            </span>
          </div>
          <p className={cn("mt-1 truncate", own ? "text-white" : "text-text")}>
            {replacement.product.title || conversation.product.title}
          </p>
          <p
            className={cn("mt-1 text-sm", own ? "text-white/75" : "text-muted")}
          >
            Quantity: {replacement.quantity}
          </p>
          {detail && (
            <p
              className={cn(
                "mt-2 text-sm",
                own ? "text-white/75" : "text-muted",
              )}
            >
              {detail}
            </p>
          )}
        </div>
      </div>
      {replacement.availableActions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {replacement.availableActions.includes("ACCEPT") && (
            <Button
              size="sm"
              loading={loading}
              onClick={() =>
                onAction({
                  kind: "ACCEPT",
                  replacementId: replacement.id,
                  requestId: replacement.inrRequestId,
                })
              }
            >
              Accept replacement
            </Button>
          )}
          {replacement.availableActions.includes("DECLINE") && (
            <Button
              size="sm"
              variant="danger"
              loading={loading}
              onClick={() =>
                onAction({
                  kind: "DECLINE",
                  replacementId: replacement.id,
                  requestId: replacement.inrRequestId,
                })
              }
            >
              Decline
            </Button>
          )}
          {replacement.availableActions.includes("REFUND_INSTEAD") && (
            <Button
              size="sm"
              variant="secondary"
              disabled={loading}
              onClick={() =>
                onAction({
                  kind: "REFUND_INSTEAD",
                  replacementId: replacement.id,
                  requestId: replacement.inrRequestId,
                })
              }
            >
              I want a refund instead
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function OfferCard({
  offer,
  conversation,
  own,
  loading,
  onAction,
  onBuy,
}: {
  offer: OfferPayload;
  conversation: ConversationSummary;
  own: boolean;
  loading: boolean;
  onAction: (action: {
    kind: "accept" | "decline" | "counter" | "retract";
    offerId: string;
    price?: number;
    quantity?: number;
  }) => void;
  onBuy: (offer: OfferPayload) => void;
}) {
  const [counterOpen, setCounterOpen] = useState(false);
  const [retractOpen, setRetractOpen] = useState(false);
  const [counter, setCounter] = useState("");
  const [counterQuantity, setCounterQuantity] = useState(
    String(offer.quantity ?? 1),
  );
  const canAct = offer.status === "PENDING" && !own;
  const canRetract = offer.status === "PENDING" && own;
  const canBuy = offer.status === "ACCEPTED" && conversation.role === "BUYER";
  const orderId = offer.orderId ?? conversation.orderId;

  useEffect(() => {
    if (offer.status !== "PENDING") setCounterOpen(false);
  }, [offer.status]);

  const isCounter = Boolean(offer.parentOfferId);
  const displayStatus =
    offer.status === "WITHDRAWN" ? "RETRACTED" : offer.status;
  const proposalLabel = isCounter ? "counteroffer" : "offer";
  const senderLabel =
    String(offer.createdBy) === String(offer.buyerId) ? "buyer" : "seller";
  const senderBadge = own
    ? "You"
    : senderLabel === "buyer"
      ? "Buyer"
      : "Seller";
  const mutedText = own ? "text-white/75" : "text-muted";
  const strongText = own ? "text-white" : "text-text";
  const priceText = own ? "text-white" : undefined;
  const quantity = offer.quantity ?? 1;
  const unitPrice = offer.offerPrice ?? offer.amount ?? 0;

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-2xl border p-4 text-sm shadow-sm",
        own
          ? "rounded-br-md border-primary bg-primary text-white"
          : "rounded-bl-md border-border bg-surface text-text",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">
          {offer.status === "WITHDRAWN"
            ? `${isCounter ? "Counteroffer" : "Offer"} retracted`
            : own
              ? `Your ${proposalLabel}`
              : `${isCounter ? "Counteroffer" : "Offer"} received`}
        </p>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
            own ? "bg-white/15 text-white" : "bg-surface-2 text-muted",
          )}
        >
          {senderBadge}
        </span>
      </div>
      <p className={cn("mt-2 font-medium", strongText)}>
        {conversation.product.title}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <span className={mutedText}>Original</span>
        <span>
          <Price cents={offer.originalPrice} className={priceText} /> each
        </span>
        <span className={mutedText}>Offer</span>
        <span>
          <Price cents={unitPrice} className={priceText} /> each
        </span>
        {quantity > 1 && (
          <>
            <span className={mutedText}>Quantity</span>
            <span className={strongText}>{quantity}</span>
            <span className={mutedText}>Total</span>
            <Price cents={unitPrice * quantity} className={priceText} />
          </>
        )}
      </div>
      <p
        className={cn(
          "mt-3 w-fit rounded-full px-2 py-1 text-xs font-bold",
          own ? "bg-white/15 text-white" : "bg-surface-2 text-text",
        )}
      >
        {displayStatus}
      </p>
      {offer.status === "PENDING" && own && (
        <p className={cn("mt-2 text-sm", mutedText)}>
          Awaiting {conversation.role === "BUYER" ? "seller" : "buyer"}{" "}
          response.
        </p>
      )}
      {offer.status === "WITHDRAWN" && (
        <p className={cn("mt-2 text-sm", mutedText)}>
          Retracted by {senderLabel}. This proposal is no longer actionable.
        </p>
      )}
      {canAct && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            loading={loading}
            onClick={() => onAction({ kind: "accept", offerId: offer.id })}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={loading}
            onClick={() => setCounterOpen(true)}
          >
            Counter
          </Button>
          <Button
            size="sm"
            variant="danger"
            loading={loading}
            onClick={() => onAction({ kind: "decline", offerId: offer.id })}
          >
            Decline
          </Button>
        </div>
      )}
      {canRetract && (
        <div className="mt-4">
          <Button
            size="sm"
            variant="danger"
            loading={loading}
            onClick={() => setRetractOpen(true)}
          >
            Retract {proposalLabel}
          </Button>
        </div>
      )}
      {offer.status === "ACCEPTED" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "text-sm font-semibold",
              own ? "text-white" : "text-success",
            )}
          >
            Offer accepted. Accepted price:{" "}
            <Price cents={unitPrice} className={priceText} /> each
          </p>
          {canBuy && (
            <Button size="sm" onClick={() => onBuy(offer)}>
              Buy at offer price
            </Button>
          )}
        </div>
      )}
      {offer.status === "PURCHASED" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "text-sm font-semibold",
              own ? "text-white" : "text-success",
            )}
          >
            Purchased at <Price cents={unitPrice} className={priceText} /> each
          </p>
          {orderId && (
            <Link to={paths.order(orderId)}>
              <Button size="sm" variant="secondary">
                View Order
              </Button>
            </Link>
          )}
        </div>
      )}
      <Modal
        open={counterOpen}
        onClose={() => setCounterOpen(false)}
        title="Counter offer"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCounterOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onAction({
                  kind: "counter",
                  offerId: offer.id,
                  price: Number(counter),
                  quantity: Number(counterQuantity),
                });
                setCounterOpen(false);
              }}
              disabled={!Number(counter) || !Number(counterQuantity)}
            >
              Submit Counter
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-muted">
            Current offer: <Price cents={unitPrice} /> each
          </p>
          <Input
            type="number"
            min={1}
            label="Counter"
            value={counter}
            onChange={(e) => setCounter(e.target.value)}
          />
          {(conversation.product.stock ?? 1) > 1 && (
            <Input
              type="number"
              min={1}
              max={
                conversation.role === "SELLER"
                  ? quantity
                  : (conversation.product.stock ?? quantity)
              }
              label="Quantity"
              value={counterQuantity}
              onChange={(e) => setCounterQuantity(e.target.value)}
            />
          )}
          <p className="text-sm text-muted">
            Counter total:{" "}
            <Price
              cents={Number(counter || 0) * Number(counterQuantity || 1)}
            />
          </p>
        </div>
      </Modal>
      <Modal
        open={retractOpen}
        onClose={() => setRetractOpen(false)}
        title={`Retract this ${proposalLabel}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRetractOpen(false)}>
              Keep {proposalLabel}
            </Button>
            <Button
              variant="danger"
              loading={loading}
              onClick={() => {
                onAction({ kind: "retract", offerId: offer.id });
                setRetractOpen(false);
              }}
            >
              Retract {proposalLabel}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-muted">
            The amount <Price cents={unitPrice} /> will stay in the conversation
            history, but the other user will no longer be able to accept it.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function Composer({
  disabled,
  onSend,
  onTyping,
  canOffer,
  onMakeOffer,
  productStock,
  productPrice,
  offerLoading,
  sending,
}: {
  disabled: boolean;
  onSend: (
    content: string,
    sendCopyToEmail: boolean,
    attachments: LocalAttachment[],
    restoreDraft: () => void,
  ) => void;
  onTyping: () => void;
  canOffer: boolean;
  onMakeOffer: (price: number, quantity: number) => void;
  productStock: number;
  productPrice: number;
  offerLoading: boolean;
  sending: boolean;
}) {
  const [content, setContent] = useState("");
  const [copy, setCopy] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerQuantity, setOfferQuantity] = useState("1");
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<LocalAttachment[]>([]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(
    () => () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      });
    },
    [],
  );

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((attachment) => attachment.id !== id);
    });
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    if (attachments.length + incoming.length > MAX_ATTACHMENTS) {
      setAttachmentError(`Maximum ${MAX_ATTACHMENTS} attachments per message.`);
      return;
    }
    const accepted: LocalAttachment[] = [];
    for (const file of incoming) {
      if (!ALLOWED_ATTACHMENT_MIMES.has(file.type)) {
        setAttachmentError(`${file.name} is not a supported attachment type.`);
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachmentError(`${file.name} is too large.`);
        return;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
        type: file.type.startsWith("image/") ? "IMAGE" : "FILE",
      });
    }
    setAttachmentError(null);
    setAttachments((current) => [...current, ...accepted]);
  };

  const submit = () => {
    const text = content.trim();
    if (!text && attachments.length === 0) return;
    onSend(text, copy, attachments, () => setContent(text));
    attachments.forEach((attachment) => {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    });
    setContent("");
    setAttachments([]);
  };
  return (
    <footer className="border-t border-border bg-surface px-4 py-3">
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative rounded-md border border-border bg-surface-2 p-2"
            >
              {attachment.previewUrl ? (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.file.name}
                  className="h-16 w-16 rounded object-cover"
                />
              ) : (
                <div className="flex h-16 w-40 flex-col justify-center rounded bg-surface px-2 text-xs text-text">
                  <span className="truncate font-semibold">
                    {attachment.file.name}
                  </span>
                  <span className="text-muted">
                    {formatBytes(attachment.file.size)}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="absolute -right-2 -top-2 rounded-full bg-danger p-1 text-white"
                aria-label="Remove attachment"
              >
                <Icon variant="icon-close" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {attachmentError && (
        <p className="mb-2 text-sm text-danger">{attachmentError}</p>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.doc,.docx"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={
            disabled || sending || attachments.length >= MAX_ATTACHMENTS
          }
          onClick={() => inputRef.current?.click()}
          title="Attach files"
        >
          <Icon variant="icon-package" size={18} />
        </Button>
        <div className="min-w-0 flex-1">
          <Textarea
            rows={2}
            value={content}
            disabled={disabled}
            placeholder="Type a message..."
            onChange={(e) => {
              setContent(e.target.value);
              onTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="min-h-[48px] resize-none rounded-lg"
          />
        </div>
        <Button
          onClick={submit}
          disabled={
            (!content.trim() && attachments.length === 0) || disabled || sending
          }
          loading={sending}
          className="h-12 shrink-0"
        >
          Send
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={copy}
            onChange={(e) => setCopy(e.target.checked)}
          />
          Send a copy to my email
        </label>
        {canOffer && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setOfferOpen(true)}
            loading={offerLoading}
          >
            <Icon variant="icon-tag" size={14} />
            Make Offer
          </Button>
        )}
      </div>
      <Modal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        title="Make offer"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOfferOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onMakeOffer(Number(offerPrice), Number(offerQuantity));
                setOfferOpen(false);
                setOfferPrice("");
                setOfferQuantity("1");
              }}
              disabled={!Number(offerPrice) || !Number(offerQuantity)}
            >
              Submit Offer
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {productStock > 1 && (
            <Input
              type="number"
              min={1}
              max={productStock}
              label="Quantity"
              value={offerQuantity}
              onChange={(e) => setOfferQuantity(e.target.value)}
            />
          )}
          <Input
            type="number"
            min={1}
            max={Math.max(1, productPrice - 1)}
            label="Offer price per item"
            value={offerPrice}
            onChange={(e) => setOfferPrice(e.target.value)}
          />
          <p className="text-sm text-muted">
            Offer total:{" "}
            <Price
              cents={Number(offerPrice || 0) * Number(offerQuantity || 1)}
            />
          </p>
        </div>
      </Modal>
    </footer>
  );
}

function ConversationSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="h-12 w-12 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
