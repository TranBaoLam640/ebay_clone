import type { PaginationMeta } from "@/services/types";

export type InrStatus = "OPEN" | "CLOSED";
export type InrResolution = "REFUND" | "WANT_ITEM";
export type InrType = "ITEM_NOT_RECEIVED";
export type InrCloseReason = "ITEM_ARRIVED" | "SELLER_REFUNDED";
export type InrReplacementStatus =
  | "PROPOSED"
  | "ACCEPTED"
  | "FULFILLING"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED"
  | "FAILED";
export type InrReplacementDisplayState =
  InrReplacementStatus | "REFUND_REQUESTED";
export type InrReplacementAction =
  | "PROPOSE_REPLACEMENT"
  | "ACCEPT_REPLACEMENT"
  | "DECLINE_REPLACEMENT"
  | "REFUND_INSTEAD"
  | "PREPARE_REPLACEMENT_SHIPMENT"
  | "ISSUE_REFUND";

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
  status: "READY_FOR_PICKUP" | "IN_TRANSIT" | "DELIVERED";
  estimatedDeliveryAt: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
}

export interface InrSellerShipment extends InrSafeShipment {
  carrier: string;
  trackingNumber: string;
}

export interface InrReplacementShipment {
  id: string;
  status: "READY_FOR_PICKUP" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
  estimatedDeliveryAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  carrier?: string;
  trackingNumber?: string;
}

export interface InrReplacementSummary {
  id: string;
  status: InrReplacementStatus;
  displayState: InrReplacementDisplayState;
  initiatorRole: "BUYER" | "SELLER";
  quantity: number;
  product: {
    id: string;
    title: string | null;
    image: string | null;
  };
  shipment: InrReplacementShipment | null;
  createdAt: string;
  updatedAt: string;
}

export interface InrReplacementResolution {
  current: InrReplacementSummary | null;
  history: InrReplacementSummary[];
  availableActions: InrReplacementAction[];
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
  refundId: string | null;
  replacementResolution: InrReplacementResolution;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  closeReason: InrCloseReason | null;
}

export interface InrRefundSummary {
  id: string;
  amount: number;
  currency: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  method: "COD" | "PAYPAL";
  completedAt: string | null;
  createdAt: string;
  updatedAt?: string;
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
  refund: InrRefundSummary | null;
}

export interface InrRefundPreview {
  requestId: string;
  orderId: string;
  refundAmount: number;
  currency: string;
  summary: {
    purchasePrice: number;
    shipping: number;
    feeCredits: number;
    amountYouOwe: number;
  };
  paymentMethod: "COD" | "PAYPAL";
  refundable: boolean;
  product: {
    id: string;
    title: string;
    image: string | null;
  };
  buyer: {
    displayName: string;
  };
  datePurchased: string;
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
