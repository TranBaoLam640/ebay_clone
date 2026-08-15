import { apiGet, apiMutate } from '@/services/api-client';

export interface Address {
  id: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  ward: string;
  district: string;
  province: string;
  country: string;
  postalCode?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AddressInput = Omit<Address, 'id' | 'isDefault' | 'createdAt' | 'updatedAt'>;

/** Backend returns Mongoose docs keyed by `_id`; expose a stable `id`. */
function normalize(raw: Record<string, unknown>): Address {
  return { ...(raw as unknown as Address), id: (raw._id ?? raw.id) as string };
}

export const addressApi = {
  list: async () => (await apiGet<Record<string, unknown>[]>('/addresses')).map(normalize),
  create: async (data: AddressInput) =>
    normalize(await apiMutate<Record<string, unknown>>('post', '/addresses', data)),
  update: async (id: string, data: Partial<AddressInput>) =>
    normalize(await apiMutate<Record<string, unknown>>('patch', `/addresses/${id}`, data)),
  remove: (id: string) => apiMutate<{ deleted: boolean }>('delete', `/addresses/${id}`),
  setDefault: async (id: string) =>
    normalize(await apiMutate<Record<string, unknown>>('patch', `/addresses/${id}/default`)),
};
