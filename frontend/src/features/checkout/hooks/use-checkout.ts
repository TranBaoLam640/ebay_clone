import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  checkoutApi,
  ordersApi,
  type CheckoutInput,
  type CheckoutPreview,
  type PaymentMethod,
} from '../services/checkout-api';

/**
 * Checkout preview query — recomputed whenever the selection, address, payment
 * method, or coupon changes. Disabled until an address is chosen.
 */
export function useCheckoutPreview(input: CheckoutInput | null) {
  return useQuery({
    queryKey: ['checkout-preview', input],
    queryFn: () => checkoutApi.preview(input as CheckoutInput),
    enabled: !!input && input.selectedCartItemIds.length > 0 && !!input.addressId,
    staleTime: 0,
  });
}

/** Validate a coupon code against the selected lines. */
export function useCouponValidation() {
  return useMutation({
    mutationFn: ({ code, itemIds }: { code: string; itemIds: string[] }) =>
      checkoutApi.validateCoupon(code, itemIds),
  });
}

/**
 * Place the order. Generates one idempotency key per attempt so a retried
 * network call can't double-charge.
 * - COD: confirmed immediately (no external gateway).
 * - PayPal: the provider order is created here; the caller then shows an
 *   approval step and calls `useCapturePayPal` to finalize. Not captured yet.
 */
export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CheckoutInput) => {
      const key = idempotencyKey();
      const group = await checkoutApi.execute(input, key);
      if (input.paymentMethod === 'PAYPAL') {
        await checkoutApi.createPayPal(group.id);
      } else {
        await checkoutApi.confirmCod(group.id).catch(() => undefined);
      }
      return group;
    },
    onSuccess: () => {
      // Cart is emptied on placement; orders list refreshes for COD.
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

/**
 * Pay for an existing auction / Buy-It-Now win order. Same shape as
 * `usePlaceOrder` but targets a pre-created order instead of the cart:
 * - COD: confirmed immediately.
 * - PayPal: provider order created here; the caller shows the approval step and
 *   calls `useCapturePayPal` to finalize.
 */
export function usePayForOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      orderId: string;
      addressId: string;
      paymentMethod: PaymentMethod;
    }) => {
      const group = await ordersApi.checkoutOrder(input.orderId, {
        addressId: input.addressId,
        paymentMethod: input.paymentMethod,
      });
      if (input.paymentMethod === 'PAYPAL') {
        await checkoutApi.createPayPal(group.id);
      } else {
        await checkoutApi.confirmCod(group.id).catch(() => undefined);
      }
      return group;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order'] });
      qc.invalidateQueries({ queryKey: ['my-bids'] });
    },
  });
}

/** Capture an already-created PayPal order after the buyer approves it. */
export function useCapturePayPal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (checkoutGroupId: string) => checkoutApi.capturePayPal(checkoutGroupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export type { CheckoutPreview };

// Unique-enough key without Date.now/Math.random restrictions in this codebase's
// hot paths — crypto UUID is available in the browser.
function idempotencyKey(): string {
  return crypto.randomUUID();
}
