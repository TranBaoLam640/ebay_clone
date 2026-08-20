import { apiGetPaged, apiMutate } from '@/services/api-client';
import type { Shipment } from '../types';

export type { Shipment } from '../types';

type RawShipment = Record<string, unknown>;

export function normalizeShipment(raw: RawShipment | null | undefined): Shipment | null {
  if (!raw) return null;
  return {
    id: (raw._id ?? raw.id) as string,
    orderId: raw.orderId as string,
    buyerId: raw.buyerId as string,
    sellerId: raw.sellerId as string,
    shipperId: (raw.shipperId ?? null) as string | null,
    carrier: raw.carrier as string,
    trackingNumber: raw.trackingNumber as string,
    status: raw.status as Shipment['status'],
    estimatedDeliveryAt: raw.estimatedDeliveryAt as string,
    pickedUpAt: (raw.pickedUpAt ?? null) as string | null,
    deliveredAt: (raw.deliveredAt ?? null) as string | null,
    createdAt: raw.createdAt as string,
    updatedAt: raw.updatedAt as string,
  };
}

const normalizePage = async (
  request: Promise<{ items: RawShipment[]; meta: import('@/services/types').PaginationMeta }>,
) => {
  const page = await request;
  return {
    ...page,
    items: page.items.map((item) => normalizeShipment(item)!),
  };
};

export const shipmentApi = {
  listShipper: (scope: 'available' | 'mine') =>
    normalizePage(apiGetPaged<RawShipment>('/shipments', { scope, page: 1, limit: 50 })),
  listSeller: () =>
    normalizePage(apiGetPaged<RawShipment>('/shipments/seller', { page: 1, limit: 50 })),
  pickup: async (shipmentId: string) =>
    normalizeShipment(await apiMutate<RawShipment>('patch', `/shipments/${shipmentId}/pickup`))!,
  deliver: async (shipmentId: string) =>
    normalizeShipment(await apiMutate<RawShipment>('patch', `/shipments/${shipmentId}/deliver`))!,
};
