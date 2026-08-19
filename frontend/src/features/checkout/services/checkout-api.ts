import { apiGet, apiMutate } from '@/services/api-client';
import type { ServerCartItem } from '@/features/cart/services/cart-api';
import type { CatalogProductSummary } from '@/features/catalog/types/catalog.types';

export type PaymentMethod = 'COD' | 'PAYPAL';

/** Shipping address snapshot echoed by preview/order (subset of the address). */
export interface AddressSnapshot {
  fullName: string;
  phone: string;
  addressLine: string;
  ward: string;
  district: string;
  province: string;
  country: string;
}

export interface SellerGroup {
  sellerId: string;
  sellerDisplayName: string;
  items: ServerCartItem[];
  subtotal: number;
  discount: number;
  total: number;
}

export interface CheckoutPreview {
  selectedItems: ServerCartItem[];
  sellerGroups: SellerGroup[];
  address: AddressSnapshot;
  subtotal: number;
  discount: number;
  total: number;
  stockWarnings: { productId: string; message: string }[];
  paymentMethods: PaymentMethod[];
  selectedPaymentMethod: PaymentMethod;
  offer?: { id: string; originalPrice: number; finalPrice: number } | null;
}

export interface CheckoutInput {
  selectedCartItemIds: string[];
  addressId: string;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  offerId?: string;
}

export interface CheckoutGroupResult {
  id: string;
  orderIds: string[];
  paymentId: string;
  paymentMethod: PaymentMethod;
  status: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  currency: string;
}

export interface CouponValidation {
  code: string;
  discount: number;
  valid: boolean;
}

/** Normalize the checkout-group envelope (backend returns `_id`). */
function normalizeGroup(raw: Record<string, unknown>): CheckoutGroupResult {
  return {
    id: (raw._id ?? raw.id) as string,
    orderIds: (raw.orderIds ?? []) as string[],
    paymentId: raw.paymentId as string,
    paymentMethod: raw.paymentMethod as PaymentMethod,
    status: raw.status as string,
    subtotal: raw.subtotal as number,
    discount: raw.discount as number,
    shippingFee: raw.shippingFee as number,
    total: raw.total as number,
    currency: raw.currency as string,
  };
}

export const checkoutApi = {
  preview: (input: CheckoutInput) => apiMutate<CheckoutPreview>('post', '/checkout/preview', input),

  /** Place the order. The idempotency key makes a retried request safe. */
  execute: async (input: CheckoutInput, idempotencyKey: string) => {
    const raw = await apiMutate<Record<string, unknown>>('post', '/checkout', input, {
      'Idempotency-Key': idempotencyKey,
    });
    return normalizeGroup(raw);
  },

  validateCoupon: (code: string, selectedCartItemIds: string[]) =>
    apiMutate<CouponValidation>('post', '/coupons/validate', { code, selectedCartItemIds }),

  /** COD orders need an explicit confirmation after placement. */
  confirmCod: (checkoutGroupId: string) =>
    apiMutate<{ status: string }>('post', '/payments/cod/confirm', { checkoutGroupId }),

  /** PayPal: create the provider order (simulation) after placement. */
  createPayPal: (checkoutGroupId: string) =>
    apiMutate<{ status: string }>('post', '/payments/paypal/create', { checkoutGroupId }),

  /** PayPal: capture the approved order → confirms the checkout group. */
  capturePayPal: (checkoutGroupId: string) =>
    apiMutate<{ status: string }>('post', '/payments/paypal/capture', { checkoutGroupId }),
};

/** Order line. Carries a product snapshot (title/price) taken at purchase time. */
export interface OrderItem {
  id: string;
  /** Internal product ref (ObjectId). Kept for parity; not used to address the API. */
  productId: string;
  /** Public product uuid — use this to fetch/link/review the product (may be absent on older orders). */
  productUuid: string | null;
  /** Whether this line already has a product review (one review per item). */
  reviewed: boolean;
  productReviewAvailable: boolean;
  canWriteProductReview: boolean;
  catalogProduct: Pick<CatalogProductSummary, 'id' | 'ePID' | 'name'> | null;
  productReview: {
    id: string;
    rating: number;
    title: string;
    description: string | null;
    comment: string | null;
    createdAt: string;
  } | null;
  /** Whether this line already has SellerFeedback; UI fetches detail to handle automated replacement. */
  sellerFeedbacked: boolean;
  quantity: number;
  /** Snapshot fields stored on the order — render these directly (no product fetch needed). */
  title: string | null;
  image: string | null;
  unitPrice: number | null;
  itemSubtotal: number | null;
  offerId?: string;
  originalPrice?: number;
  finalPrice?: number;
}

export interface OrderSummary {
  id: string;
  orderStatus: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  currency: string;
  createdAt: string;
  sellerId: string;
  /** Whether this order already has seller feedback (one rating per order). */
  sellerRated: boolean;
  items: OrderItem[];
}

export interface OrderDetail extends OrderSummary {
  // Absent on a not-yet-paid auction / Buy-It-Now win — the winner picks the
  // address during checkout, so the detail view must render without it.
  shippingAddress?: AddressSnapshot | null;
}

/** Backend returns raw Mongoose docs (`_id`); flatten to `id`. */
function normalizeOrder<T extends OrderSummary>(raw: Record<string, unknown>): T {
  return {
    ...raw,
    id: (raw._id ?? raw.id) as string,
    sellerRated: Boolean(raw.sellerRated),
    items: ((raw.items ?? []) as Record<string, unknown>[]).map((it) => ({
      id: (it._id ?? it.id) as string,
      productId: it.productId as string,
      productUuid: (it.productUuid ?? null) as string | null,
      productReviewAvailable: Boolean(it.productReviewAvailable),
      canWriteProductReview: Boolean(it.canWriteProductReview),
      catalogProduct:
        (it.catalogProduct as Pick<
          CatalogProductSummary,
          'id' | 'ePID' | 'name'
        > | null | undefined) ?? null,
      productReview:
        (it.productReview as OrderItem['productReview'] | undefined) ?? null,
      reviewed: Boolean(it.reviewed),
      sellerFeedbacked: Boolean(it.sellerFeedbacked),
      quantity: it.quantity as number,
      title: (it.title ?? null) as string | null,
      image: (it.image ?? null) as string | null,
      unitPrice: (it.unitPrice ?? null) as number | null,
      itemSubtotal: (it.itemSubtotal ?? null) as number | null,
      offerId: it.offerId as string | undefined,
      originalPrice: it.originalPrice as number | undefined,
      finalPrice: it.finalPrice as number | undefined,
    })),
  } as unknown as T;
}

/** Fetch the current user's orders (buyer view). */
export const ordersApi = {
  list: async () => {
    const raw = await apiGet<Record<string, unknown>[]>('/orders');
    return raw.map((o) => normalizeOrder<OrderSummary>(o));
  },
  get: async (orderId: string) => {
    const raw = await apiGet<Record<string, unknown>>(`/orders/${orderId}`);
    return normalizeOrder<OrderDetail>(raw);
  },

  /**
   * Check out a standalone auction / Buy-It-Now win order: attach the chosen
   * address + method and wrap it in a checkout group. The returned group id then
   * drives the same confirmCod / createPayPal + capturePayPal payment flow.
   */
  checkoutOrder: async (
    orderId: string,
    input: { addressId: string; paymentMethod: PaymentMethod },
  ) => {
    const raw = await apiMutate<Record<string, unknown>>(
      'post',
      `/orders/${orderId}/checkout`,
      input,
    );
    return normalizeGroup(raw);
  },
};
