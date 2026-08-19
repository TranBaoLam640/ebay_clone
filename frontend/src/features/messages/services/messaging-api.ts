import { apiGet, apiMutate } from '@/services/api-client';

export type ConversationType = 'PRE_PURCHASE' | 'POST_PURCHASE';
export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'OFFER' | 'SYSTEM';
export type OfferStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'COUNTERED'
  | 'EXPIRED'
  | 'WITHDRAWN'
  | 'PURCHASED';

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  status: 'ACTIVE' | 'ARCHIVED';
  role: 'BUYER' | 'SELLER';
  product: {
    id: string;
    title: string;
    image: string | null;
    price: number;
    status?: string;
    stock?: number;
    listingType?: 'FIXED' | 'AUCTION';
    offersEnabled?: boolean;
  };
  seller: {
    id: string;
    displayName: string;
    username?: string | null;
    email?: string | null;
    avatarUrl: string | null;
    feedbackScore: number;
  };
  buyer?: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  orderId: string | null;
  lastMessage: {
    id: string;
    type: MessageType;
    content: string | null;
    status: 'SENT' | 'DELIVERED' | 'READ';
    createdAt: string;
  } | null;
  unreadCount: number;
  lastMessageAt: string;
  createdAt: string;
}

export interface OfferPayload {
  id: string;
  conversationId: string;
  productId: string;
  buyerId: string;
  sellerId: string | null;
  createdBy: string | null;
  originalPrice: number;
  offerPrice: number;
  amount?: number;
  quantity?: number;
  status: OfferStatus;
  parentOfferId: string | null;
  orderId?: string | null;
  usedAt?: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface MessageAttachment {
  url: string;
  fileName?: string;
  mimeType: string;
  size?: number;
  type?: 'IMAGE' | 'FILE';
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: {
    id: string;
    displayName: string;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
  type: MessageType;
  content: string | null;
  attachments: MessageAttachment[];
  offer?: OfferPayload | null;
  status: 'SENT' | 'DELIVERED' | 'READ';
  createdAt: string;
  clientMessageId?: string;
  localStatus?: 'sending' | 'sent' | 'failed';
}

export const messagingApi = {
  conversations: (params?: { limit?: number; before?: string }) =>
    apiGet<ConversationSummary[]>('/conversations', params),
  createConversation: (payload: { productId: string; orderId?: string }) =>
    apiMutate<ConversationSummary>('post', '/conversations', payload),
  messages: (
    conversationId: string,
    params?: { limit?: number; before?: string },
  ) =>
    apiGet<ConversationMessage[]>(
      `/conversations/${conversationId}/messages`,
      params,
    ),
  sendMessage: (
    conversationId: string,
    payload: {
      type?: 'TEXT' | 'IMAGE' | 'FILE';
      clientMessageId?: string;
      content?: string;
      attachments?: MessageAttachment[];
      sendCopyToEmail: boolean;
    },
  ) =>
    apiMutate<ConversationMessage>(
      'post',
      `/conversations/${conversationId}/messages`,
      payload,
    ),
  uploadAttachments: (conversationId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    return apiMutate<MessageAttachment[]>(
      'post',
      `/conversations/${conversationId}/attachments`,
      form,
    );
  },
  markRead: (conversationId: string) =>
    apiMutate<{ id: string; unreadCount: number }>(
      'patch',
      `/conversations/${conversationId}/read`,
    ),
  createOffer: (
    conversationId: string,
    payload: { price: number; quantity?: number; message?: string },
  ) =>
    apiMutate<OfferPayload>(
      'post',
      `/conversations/${conversationId}/offers`,
      payload,
    ),
  acceptOffer: (offerId: string) =>
    apiMutate<OfferPayload>('post', `/offers/${offerId}/accept`),
  declineOffer: (offerId: string) =>
    apiMutate<OfferPayload>('post', `/offers/${offerId}/decline`),
  retractOffer: (offerId: string) =>
    apiMutate<OfferPayload>('post', `/offers/${offerId}/retract`),
  counterOffer: (
    offerId: string,
    payload: { price: number; quantity?: number; message?: string },
  ) => apiMutate<OfferPayload>('post', `/offers/${offerId}/counter`, payload),
};
