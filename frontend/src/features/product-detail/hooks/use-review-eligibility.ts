import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/features/checkout/services/checkout-api';

/** A purchased, delivered line the user may review for a given product. */
export interface ReviewEligibility {
  orderId: string;
  orderItemId: string;
}

/**
 * Find whether the current user can review a product: scan their orders for a
 * DELIVERED one containing this product (matched by public uuid), and return the
 * first matching line. Returns null when there's no eligible purchase (or the
 * user isn't logged in — the orders request 401s and the query stays empty). The
 * backend still enforces the real eligibility + one-review-per-item rule on submit.
 *
 * @param productUuid the product's public uuid (as used in the URL/API).
 */
export function useReviewEligibility(productUuid: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['review-eligibility', productUuid],
    enabled: !!productUuid && enabled,
    queryFn: async (): Promise<ReviewEligibility | null> => {
      const orders = await ordersApi.list();
      for (const order of orders) {
        if (order.orderStatus !== 'DELIVERED') continue;
        // Skip lines already reviewed — one review per order item.
        const line = order.items.find(
          (it) => it.productUuid === productUuid && !it.reviewed,
        );
        if (line) return { orderId: order.id, orderItemId: line.id };
      }
      return null;
    },
    // Guests / network errors shouldn't spam retries or surface an error UI.
    retry: false,
    staleTime: 60_000,
  });
}
