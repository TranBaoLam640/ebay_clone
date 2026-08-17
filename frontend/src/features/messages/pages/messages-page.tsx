import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { Input } from '@/components/input';
import { Modal } from '@/components/modal';
import { Price } from '@/components/price';
import { Skeleton } from '@/components/skeleton';
import { Textarea } from '@/components/textarea';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { messageFromError } from '@/features/auth/utils/auth-errors';
import { useToast } from '@/contexts/toast-context';
import { cartApi } from '@/features/cart/services/cart-api';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format-date';
import { useChatSocket } from '../hooks/use-chat-socket';
import type { ConversationUpdatedPayload } from '../hooks/use-chat-socket';
import {
  messagingApi,
  type ConversationMessage,
  type ConversationSummary,
  type MessageAttachment,
  type OfferPayload,
} from '../services/messaging-api';

const PAGE_SIZE = 30;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

interface LocalAttachment {
  id: string;
  file: File;
  previewUrl: string | null;
  type: 'IMAGE' | 'FILE';
}

export default function MessagesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const selectedId = search.get('conversation');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [hasOlder, setHasOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);

  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagingApi.conversations({ limit: 50 }),
  });
  const selected = conversations.data?.find((item) => item.id === selectedId) ?? null;

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
            (message.localStatus === 'sending' &&
              message.content === incoming.content &&
              message.senderId === incoming.senderId)
          ),
      );
      return [...withoutTemp, { ...incoming, localStatus: 'sent' }];
    });
  }, []);

  const updateOfferInMessages = useCallback((offer: OfferPayload) => {
    setMessages((current) =>
      current.map((message) =>
        message.offer?.id === offer.id ? { ...message, offer } : message,
      ),
    );
  }, []);

  const refreshConversationList = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['conversations'] });
  }, [qc]);

  const mergeConversationUpdate = useCallback(
    (payload: ConversationUpdatedPayload) => {
      qc.setQueryData<ConversationSummary[]>(['conversations'], (current) =>
        current?.map((conversation) =>
          conversation.id === payload.id
            ? {
                ...conversation,
                ...(payload.type && { type: payload.type }),
                ...(payload.orderId !== undefined && { orderId: payload.orderId }),
                ...(payload.lastMessage && { lastMessage: payload.lastMessage }),
              }
            : conversation,
        ),
      );
    },
    [qc],
  );

  const socket = useChatSocket({
    conversationId: selectedId,
    onMessage: useCallback(
      (message) => {
        if (message.conversationId === selectedId) mergeMessage(message);
        refreshConversationList();
      },
      [mergeMessage, refreshConversationList, selectedId],
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
        refreshConversationList();
      },
      [refreshConversationList, selectedId],
    ),
    onOfferUpdated: useCallback(
      (offer) => {
        updateOfferInMessages(offer);
        refreshConversationList();
      },
      [refreshConversationList, updateOfferInMessages],
    ),
    onRead: useCallback(
      (payload) => {
        if (payload.conversationId === selectedId) {
          setMessages((current) =>
            current.map((message) =>
              message.senderId === user?.id ? { ...message, status: 'READ' } : message,
            ),
          );
        }
        refreshConversationList();
      },
      [refreshConversationList, selectedId, user?.id],
    ),
    onTyping: useCallback(
      (payload) => {
        if (payload.conversationId === selectedId && payload.userId !== user?.id) {
          setTypingUser(payload.userId);
        }
      },
      [selectedId, user?.id],
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
        refreshConversationList();
      },
      [mergeConversationUpdate, refreshConversationList],
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
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        });
        return messagingApi.markRead(selectedId);
      })
      .then(refreshConversationList)
      .catch((err) => notify(messageFromError(err), 'error'));
  }, [notify, refreshConversationList, selectedId]);

  useEffect(() => {
    if (socket.connected && selectedId) {
      messagingApi.messages(selectedId, { limit: PAGE_SIZE }).then((items) => {
        setMessages((current) => {
          const existing = new Set(current.map((message) => message.id));
          return [...current, ...items.filter((message) => !existing.has(message.id))].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        });
      });
    }
  }, [selectedId, socket.connected]);

  const loadOlder = async () => {
    if (!selectedId || !hasOlder || loadingOlder || messages.length === 0) return;
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
        return [...older.filter((message) => !existing.has(message.id)), ...current];
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
      if (!selectedId) throw new Error('No conversation selected');
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
            ? { ...message, localStatus: 'sending' }
            : message,
        ),
      );
    },
    onSuccess: ({ clientMessageId, saved }) => {
      setMessages((current) =>
        current.map((message) =>
          message.clientMessageId === clientMessageId
            ? { ...saved, clientMessageId, localStatus: 'sent' }
            : message,
        ),
      );
      refreshConversationList();
    },
    onError: (_err, variables) => {
      setMessages((current) =>
        current.map((message) =>
          message.clientMessageId === variables.clientMessageId
            ? { ...message, localStatus: 'failed' }
            : message,
        ),
      );
      variables.restoreDraft?.();
    },
  });

  const offerAction = useMutation({
    mutationFn: (action: { kind: 'make' | 'accept' | 'decline' | 'counter'; offerId?: string; price?: number }) => {
      if (action.kind === 'accept') return messagingApi.acceptOffer(action.offerId!);
      if (action.kind === 'decline') return messagingApi.declineOffer(action.offerId!);
      if (action.kind === 'counter') return messagingApi.counterOffer(action.offerId!, { price: action.price! });
      return messagingApi.createOffer(selectedId!, { price: action.price! });
    },
    onSuccess: (offer) => {
      updateOfferInMessages(offer);
      refreshConversationList();
      if (selectedId) {
        messagingApi.messages(selectedId, { limit: PAGE_SIZE }).then((items) => {
          setMessages((current) => {
            const existing = new Set(current.map((message) => message.id));
            return [...current, ...items.filter((message) => !existing.has(message.id))].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            );
          });
        });
      }
    },
    onError: (err) => notify(messageFromError(err), 'error'),
  });

  const handleScroll = () => {
    if (scrollRef.current && scrollRef.current.scrollTop < 80) loadOlder();
  };

  const selectedMessages = useMemo(() => messages, [messages]);

  return (
    <div className="mx-auto flex h-[calc(100vh-96px)] max-w-[1280px] flex-col px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Messages</h1>
          <p className="text-sm text-muted">
            {socket.connected ? 'Realtime connected' : 'Realtime reconnecting'}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface">
        <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
          <aside className={cn('min-h-0 border-border md:border-r', selectedId && 'hidden md:block')}>
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
                <EmptyState icon="icon-mail" title="No messages yet" description="Contact a seller from a listing to start a conversation." />
              </div>
            )}
          </aside>

          <main className={cn('min-h-0', !selectedId && 'hidden md:block')}>
            {selected ? (
              <div className="flex h-full min-h-0 flex-col">
                <ChatHeader conversation={selected} onBack={() => selectConversation(null)} />
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="min-h-0 flex-1 overflow-y-auto bg-surface-2/40 px-4 py-4"
                >
                  {loadingOlder && <p className="pb-2 text-center text-xs text-muted">Loading older messages...</p>}
                  {selectedMessages.length === 0 ? (
                    <EmptyState icon="icon-mail" title="No messages yet" description="Send the first message in this listing conversation." />
                  ) : (
                    <div className="flex flex-col gap-3">
                      {selectedMessages.map((message) => (
                        <MessageBubble
                          key={message.clientMessageId ?? message.id}
                          message={message}
                          own={message.senderId === user?.id}
                          conversation={selected}
                          onRetry={() => {
                            if (!message.content || !message.clientMessageId) return;
                            send.mutate({
                              content: message.content,
                              sendCopyToEmail: false,
                              clientMessageId: message.clientMessageId,
                              attachments: [],
                              restoreDraft: undefined,
                            });
                          }}
                          onOfferAction={(action) => offerAction.mutate(action)}
                          onBuyOffer={async (offer) => {
                            try {
                              await cartApi.setQuantity(
                                selected.product.id,
                                offer.quantity ?? 1,
                              );
                              navigate(`${paths.checkout}?offerId=${offer.id}`);
                            } catch (err) {
                              notify(messageFromError(err), 'error');
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {typingUser && <p className="mt-3 text-sm text-muted">{selected.seller.displayName} is typing...</p>}
                </div>
                <Composer
                  disabled={!selectedId}
                  onTyping={() => {
                    socket.startTyping();
                    if (typingTimer.current) window.clearTimeout(typingTimer.current);
                    typingTimer.current = window.setTimeout(socket.stopTyping, 1200);
                  }}
                  onSend={(content, sendCopyToEmail, attachments, restoreDraft) => {
                    const clientMessageId = crypto.randomUUID();
                    const optimisticAttachments = attachments.map((attachment) => ({
                      url: attachment.previewUrl || '',
                      fileName: attachment.file.name,
                      mimeType: attachment.file.type,
                      size: attachment.file.size,
                      type: attachment.type,
                    }));
                    const optimistic: ConversationMessage = {
                      id: clientMessageId,
                      clientMessageId,
                      conversationId: selected.id,
                      senderId: user!.id,
                      type: messageTypeFor(optimisticAttachments),
                      content,
                      attachments: optimisticAttachments,
                      status: 'SENT',
                      localStatus: 'sending',
                      createdAt: new Date().toISOString(),
                    };
                    setMessages((current) => [...current, optimistic]);
                    requestAnimationFrame(() => {
                      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    });
                    send.mutate({
                      content,
                      sendCopyToEmail,
                      clientMessageId,
                      attachments,
                      restoreDraft,
                    });
                  }}
                  sending={send.isPending}
                  canOffer={selected.type === 'PRE_PURCHASE'}
                  onMakeOffer={(price) => offerAction.mutate({ kind: 'make', price })}
                  offerLoading={offerAction.isPending}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-6">
                <EmptyState icon="icon-mail" title="Select a conversation" description="Choose a listing conversation to view messages." />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function messageTypeFor(attachments: Pick<MessageAttachment, 'type' | 'mimeType'>[]) {
  if (attachments.length === 0) return 'TEXT';
  return attachments.some(
    (attachment) =>
      attachment.type === 'FILE' || !attachment.mimeType.startsWith('image/'),
  )
    ? 'FILE'
    : 'IMAGE';
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
    conversation.lastMessage?.type === 'OFFER'
      ? 'Offer update'
      : conversation.lastMessage?.content || 'No messages yet';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full gap-3 border-b border-border p-3 text-left hover:bg-surface-2',
        active && 'bg-surface-2',
      )}
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-2">
        {conversation.product.image ? (
          <img src={conversation.product.image} alt={conversation.product.title} className="h-full w-full object-cover" />
        ) : (
          <Icon variant="icon-package" size={22} className="m-3 text-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-text">{conversation.seller.displayName}</p>
          {conversation.unreadCount > 0 && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-on-accent">
              {conversation.unreadCount}
            </span>
          )}
        </div>
        <p className="truncate text-sm text-text">{conversation.product.title}</p>
        <p className="truncate text-xs text-muted">{preview}</p>
        <p className="mt-1 text-xs text-muted">{formatDate(conversation.lastMessageAt)}</p>
      </div>
    </button>
  );
}

function ChatHeader({ conversation, onBack }: { conversation: ConversationSummary; onBack: () => void }) {
  return (
    <header className="border-b border-border bg-surface p-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="rounded-md p-2 hover:bg-surface-2 md:hidden" aria-label="Back">
          <Icon variant="icon-arrow-left" size={18} />
        </button>
        <div className="h-14 w-14 overflow-hidden rounded-md bg-surface-2">
          {conversation.product.image ? (
            <img src={conversation.product.image} alt={conversation.product.title} className="h-full w-full object-cover" />
          ) : (
            <Icon variant="icon-package" size={24} className="m-4 text-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link to={paths.product(conversation.product.id)} className="truncate font-semibold text-text hover:text-primary">
            {conversation.product.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Price cents={conversation.product.price} />
            <span>{conversation.seller.displayName}</span>
            {conversation.orderId && <span>Order #{conversation.orderId.slice(-8).toUpperCase()}</span>}
          </div>
        </div>
        <Link to={paths.product(conversation.product.id)}>
          <Button variant="secondary" size="sm">View Listing</Button>
        </Link>
        {conversation.orderId && (
          <Link to={paths.order(conversation.orderId)}>
            <Button variant="secondary" size="sm">View Order</Button>
          </Link>
        )}
      </div>
    </header>
  );
}

function MessageBubble({
  message,
  own,
  conversation,
  onRetry,
  onOfferAction,
  onBuyOffer,
}: {
  message: ConversationMessage;
  own: boolean;
  conversation: ConversationSummary;
  onRetry: () => void;
  onOfferAction: (action: { kind: 'accept' | 'decline' | 'counter'; offerId: string; price?: number }) => void;
  onBuyOffer: (offer: OfferPayload) => void;
}) {
  return (
    <div className={cn('flex', own ? 'justify-end' : 'justify-start')}>
      {message.type === 'OFFER' && message.offer ? (
        <OfferCard
          offer={message.offer}
          conversation={conversation}
          own={own}
          onAction={onOfferAction}
          onBuy={onBuyOffer}
        />
      ) : (
        <div
          className={cn(
            'max-w-[80%] rounded-lg px-3 py-2 text-sm',
            own ? 'bg-primary text-white' : 'border border-border bg-surface text-text',
          )}
        >
          {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
          {message.attachments.length > 0 && (
            <AttachmentList attachments={message.attachments} />
          )}
          {message.type === 'SYSTEM' ? (
            <p className="text-muted">{message.content}</p>
          ) : null}
          <div className={cn('mt-1 flex items-center justify-end gap-2 text-[11px]', own ? 'text-white/75' : 'text-muted')}>
            <span>{message.localStatus === 'sending' ? 'Sending' : message.localStatus === 'failed' ? 'Failed' : message.status === 'READ' ? 'Read' : 'Sent'}</span>
            {message.localStatus === 'failed' && (
              <button type="button" onClick={onRetry} className="font-semibold underline">
                Retry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AttachmentList({ attachments }: { attachments: MessageAttachment[] }) {
  const [preview, setPreview] = useState<MessageAttachment | null>(null);
  return (
    <>
      <div className="mt-2 flex max-w-full flex-wrap gap-2">
        {attachments.map((attachment, index) =>
          attachment.type === 'IMAGE' || attachment.mimeType.startsWith('image/') ? (
            <button
              key={`${attachment.url}-${index}`}
              type="button"
              onClick={() => attachment.url && setPreview(attachment)}
              className="overflow-hidden rounded-md border border-white/20 bg-black/5"
            >
              <img
                src={attachment.url}
                alt={attachment.fileName || 'Image attachment'}
                loading="lazy"
                className="h-28 w-28 object-cover"
              />
            </button>
          ) : (
            <a
              key={`${attachment.url}-${index}`}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-[220px] max-w-full flex-col gap-1 rounded-md border border-border bg-surface p-3 text-text"
            >
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                <Icon variant="icon-package" size={16} />
                <span className="truncate">{attachment.fileName || 'File attachment'}</span>
              </span>
              <span className="text-xs text-muted">
                {fileKind(attachment)} · {formatBytes(attachment.size)}
              </span>
              <span className="text-xs font-semibold text-primary">View / Download</span>
            </a>
          ),
        )}
      </div>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.fileName || 'Image preview'} size="lg">
        {preview && (
          <img
            src={preview.url}
            alt={preview.fileName || 'Image attachment'}
            className="max-h-[70vh] w-full object-contain"
          />
        )}
      </Modal>
    </>
  );
}

function fileKind(attachment: MessageAttachment) {
  return (attachment.fileName?.split('.').pop() || attachment.mimeType || 'file').toUpperCase();
}

function formatBytes(size?: number) {
  if (!size) return 'unknown size';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function OfferCard({
  offer,
  conversation,
  own,
  onAction,
  onBuy,
}: {
  offer: OfferPayload;
  conversation: ConversationSummary;
  own: boolean;
  onAction: (action: { kind: 'accept' | 'decline' | 'counter'; offerId: string; price?: number }) => void;
  onBuy: (offer: OfferPayload) => void;
}) {
  const [counterOpen, setCounterOpen] = useState(false);
  const [counter, setCounter] = useState('');
  const canAct = conversation.type === 'PRE_PURCHASE' && offer.status === 'PENDING' && !own;
  const canBuy =
    conversation.type === 'PRE_PURCHASE' &&
    offer.status === 'ACCEPTED' &&
    conversation.role === 'BUYER';
  const orderId = offer.orderId ?? conversation.orderId;

  useEffect(() => {
    if (offer.status !== 'PENDING') setCounterOpen(false);
  }, [offer.status]);

  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-surface p-4 text-sm text-text">
      <p className="font-semibold">{own ? 'You sent an offer' : 'Offer received'}</p>
      <p className="mt-2 font-medium">{conversation.product.title}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <span className="text-muted">Original</span>
        <Price cents={offer.originalPrice} />
        <span className="text-muted">Offer</span>
        <Price cents={offer.offerPrice ?? offer.amount ?? 0} />
      </div>
      <p className="mt-3 w-fit rounded-full bg-surface-2 px-2 py-1 text-xs font-bold">{offer.status}</p>
      {canAct && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onAction({ kind: 'accept', offerId: offer.id })}>Accept</Button>
          <Button size="sm" variant="secondary" onClick={() => setCounterOpen(true)}>Counter</Button>
          <Button size="sm" variant="danger" onClick={() => onAction({ kind: 'decline', offerId: offer.id })}>Decline</Button>
        </div>
      )}
      {offer.status === 'ACCEPTED' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-success">Offer accepted. Accepted price: <Price cents={offer.offerPrice ?? offer.amount ?? 0} /></p>
          {canBuy && (
            <Button size="sm" onClick={() => onBuy(offer)}>Buy at offer price</Button>
          )}
        </div>
      )}
      {offer.status === 'PURCHASED' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-success">Purchased at <Price cents={offer.offerPrice ?? offer.amount ?? 0} /></p>
          {orderId && (
            <Link to={paths.order(orderId)}>
              <Button size="sm" variant="secondary">View Order</Button>
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
            <Button variant="secondary" onClick={() => setCounterOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                onAction({ kind: 'counter', offerId: offer.id, price: Number(counter) });
                setCounterOpen(false);
              }}
              disabled={!Number(counter)}
            >
              Submit Counter
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-muted">Current offer: <Price cents={offer.offerPrice ?? offer.amount ?? 0} /></p>
          <Input type="number" min={1} label="Counter" value={counter} onChange={(e) => setCounter(e.target.value)} />
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
  onMakeOffer: (price: number) => void;
  offerLoading: boolean;
  sending: boolean;
}) {
  const [content, setContent] = useState('');
  const [copy, setCopy] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
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
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        type: file.type.startsWith('image/') ? 'IMAGE' : 'FILE',
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
    setContent('');
    setAttachments([]);
  };
  return (
    <footer className="border-t border-border bg-surface p-3">
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative rounded-md border border-border bg-surface-2 p-2">
              {attachment.previewUrl ? (
                <img src={attachment.previewUrl} alt={attachment.file.name} className="h-16 w-16 rounded object-cover" />
              ) : (
                <div className="flex h-16 w-40 flex-col justify-center rounded bg-surface px-2 text-xs text-text">
                  <span className="truncate font-semibold">{attachment.file.name}</span>
                  <span className="text-muted">{formatBytes(attachment.file.size)}</span>
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
      {attachmentError && <p className="mb-2 text-sm text-danger">{attachmentError}</p>}
      <div className="flex items-end gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.doc,.docx"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={disabled || sending || attachments.length >= MAX_ATTACHMENTS}
          onClick={() => inputRef.current?.click()}
          title="Attach files"
        >
          <Icon variant="icon-package" size={18} />
        </Button>
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
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="min-h-[48px] resize-none"
        />
        <Button onClick={submit} disabled={(!content.trim() && attachments.length === 0) || disabled || sending} loading={sending}>Send</Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
          Send a copy to my email
        </label>
        {canOffer && (
          <Button size="sm" variant="secondary" onClick={() => setOfferOpen(true)} loading={offerLoading}>
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
            <Button variant="secondary" onClick={() => setOfferOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                onMakeOffer(Number(offerPrice));
                setOfferOpen(false);
                setOfferPrice('');
              }}
              disabled={!Number(offerPrice)}
            >
              Submit Offer
            </Button>
          </>
        }
      >
        <Input type="number" min={1} label="Your offer" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} />
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
