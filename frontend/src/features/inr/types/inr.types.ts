import type { PaginationMeta } from '@/services/types';

export type InrStatus = 'OPEN' | 'CLOSED';
export type InrResolution = 'REFUND' | 'WANT_ITEM';
export type InrType = 'ITEM_NOT_RECEIVED';

export interface InrItemSummary {
  id: string;
  productId: string;
  sellerId: string;
  title: string | null;
  image: string | null;
  quantity: number;
  unitPrice: number | null;
  itemSubtotal: number | null;
}

export interface InrSafeShipment {
  id: string;
  status: 'READY_FOR_PICKUP' | 'IN_TRANSIT' | 'DELIVERED';
  estimatedDeliveryAt: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
}

export interface InrSellerShipment extends InrSafeShipment {
  carrier: string;
  trackingNumber: string;
}

export interface InrTrackingEvidence {
  carrierId: string;
  carrierCode: string;
  carrierName: string;
  trackingId: string;
  submittedBy: string;
  submittedAt: string;
}

export interface InrBuyerRequest {
  id: string;
  type: InrType;
  orderId: string;
  orderItemId: string;
  item: InrItemSummary | null;
  quantityMissing: number;
  requestedResolution: InrResolution;
  details: string | null;
  status: InrStatus;
  requestAmount: number;
  currency: string;
  shipment: InrSafeShipment | null;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  closeReason: 'ITEM_ARRIVED' | null;
}

export interface InrSellerRequest extends InrBuyerRequest {
  buyer: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  shipment: InrSellerShipment | null;
  latestTrackingEvidence: InrTrackingEvidence | null;
  trackingEvidenceHistory: InrTrackingEvidence[];
}

export interface Carrier {
  id: string;
  code: string;
  name: string;
}

export interface CreateInrRequestInput {
  orderId: string;
  orderItemId: string;
  quantityMissing: number;
  requestedResolution: InrResolution;
  details?: string;
}

export interface InrTrackingEvidenceInput {
  carrierId: string;
  trackingId: string;
}

export interface InrListQuery {
  status?: InrStatus;
  page?: number;
  limit?: number;
}

export interface InrPage<T> {
  items: T[];
  meta: PaginationMeta;
}
