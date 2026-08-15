import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../services/catalog-api';
import type { ProductAvailability } from '../types/catalog.types';

/** Poll cadence for live stock while a product/cart is on screen. */
const POLL_MS = 5000;

export interface AvailabilityResult {
  /** Live stock/status per product id. Only present for products still on sale. */
  map: Map<string, ProductAvailability>;
  /**
   * True once a poll has resolved. Until then a missing id is "not loaded yet",
   * not "unavailable" — callers use this to avoid flashing a false warning.
   */
  loaded: boolean;
}

/**
 * Poll live stock/status for a set of product uuids via the batch availability
 * endpoint. React Query pauses the interval when the tab is hidden and refetches
 * on focus, so the data is fresh whenever the user is actually looking.
 *
 * `ids` is sorted into the query key so callers don't need a stable reference.
 */
export function useAvailability(
  ids: string[],
  enabled = true,
): AvailabilityResult {
  const key = useMemo(() => [...new Set(ids)].sort(), [ids]);
  const active = enabled && key.length > 0;

  const query = useQuery({
    queryKey: ['availability', key],
    queryFn: () => catalogApi.availability(key),
    enabled: active,
    refetchInterval: active ? POLL_MS : false,
    refetchOnWindowFocus: true,
    // Live stock is inherently volatile — never serve it stale without a refetch.
    staleTime: 0,
  });

  return useMemo(
    () => ({
      map: new Map((query.data ?? []).map((item) => [item.id, item])),
      loaded: query.isSuccess,
    }),
    [query.data, query.isSuccess],
  );
}
