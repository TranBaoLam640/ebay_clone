import type { CartItem } from '../types/cart.types';
import type { AvailabilityResult } from '@/features/catalog/hooks/use-availability';
import type {
  ProductAvailability,
  ProductStatus,
} from '@/features/catalog/types/catalog.types';

/** Live purchasable state folded from a product snapshot + latest poll result. */
export interface LiveStock {
  liveStock: number;
  liveStatus: ProductStatus | undefined;
  /** Resolved poll but the product is absent from it → no longer on sale. */
  removed: boolean;
  outOfStock: boolean;
}

/**
 * Single source of truth for turning (snapshot, latest poll, loaded?) into live
 * stock state, shared by the cart lines and the product-detail buy box so the
 * "absent-from-a-resolved-poll = removed" / "OUT_OF_STOCK or 0 = out of stock"
 * semantics can't drift between the two surfaces.
 *
 * Until the first poll resolves we trust the snapshot so nothing flashes.
 */
export function resolveLiveStock(
  snapshot: { stock: number; status?: ProductStatus },
  live: ProductAvailability | undefined,
  loaded: boolean,
): LiveStock {
  if (live)
    return {
      liveStock: live.stock,
      liveStatus: live.status,
      removed: false,
      outOfStock: live.status === 'OUT_OF_STOCK' || live.stock <= 0,
    };

  if (loaded)
    return { liveStock: 0, liveStatus: undefined, removed: true, outOfStock: true };

  // Pre-first-poll: trust the snapshot.
  return {
    liveStock: snapshot.stock,
    liveStatus: snapshot.status,
    removed: false,
    outOfStock: (snapshot.status ?? 'ACTIVE') === 'OUT_OF_STOCK' || snapshot.stock <= 0,
  };
}

/** Why a cart line can't proceed to checkout as-is (or 'none' when it's fine). */
export type LineIssue = 'none' | 'unavailable' | 'out_of_stock' | 'insufficient';

export interface LineAvailability {
  /** Current purchasable stock (0 when unavailable/out of stock). */
  liveStock: number;
  issue: LineIssue;
  /** Any issue that should disable the line and block checkout. */
  blocked: boolean;
}

/**
 * Derive a cart line's live availability state from the polled stock map.
 * Before the first poll resolves the line shows no warning (trust the snapshot).
 */
export function lineAvailability(
  item: CartItem,
  availability: AvailabilityResult,
): LineAvailability {
  const live = availability.map.get(item.productId);

  // Before the first poll we don't warn — trust the line's own snapshot.
  if (!availability.loaded && !live)
    return { liveStock: item.stock, issue: 'none', blocked: false };

  const { liveStock, removed, outOfStock } = resolveLiveStock(
    { stock: item.stock },
    live,
    availability.loaded,
  );

  if (removed) return { liveStock: 0, issue: 'unavailable', blocked: true };
  if (outOfStock) return { liveStock: 0, issue: 'out_of_stock', blocked: true };
  if (item.quantity > liveStock)
    return { liveStock, issue: 'insufficient', blocked: true };

  return { liveStock, issue: 'none', blocked: false };
}

/** True when any line in the cart blocks checkout. */
export function cartHasBlockingIssue(
  items: CartItem[],
  availability: AvailabilityResult,
): boolean {
  return items.some((item) => lineAvailability(item, availability).blocked);
}
