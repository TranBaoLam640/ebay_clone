import { apiGet, apiMutate } from '@/services/api-client';

/** A cart line as returned by the server (product snapshot embedded). */
export interface ServerCartItem {
  id: string;
  productId: string;
  quantity: number;
  itemSubtotal: number;
  product: {
    id: string;
    title: string;
    primaryImage: string | null;
    price: number;
    stock: number;
    status: string;
    seller: { id: string; displayName: string };
  };
}

export interface ServerCart {
  id: string | null;
  items: ServerCartItem[];
  subtotal: number;
  totalQuantity: number;
}

/** One line for the merge/sync payload. */
export interface CartSyncLine {
  productId: string;
  quantity: number;
}

export const cartApi = {
  get: () => apiGet<ServerCart>('/cart'),
  addItem: (productId: string, quantity: number) =>
    apiMutate<ServerCart>('post', '/cart/items', { productId, quantity }),
  setQuantity: (productId: string, quantity: number) =>
    apiMutate<ServerCart>('patch', `/cart/items/${productId}`, { quantity }),
  removeItem: (productId: string) =>
    apiMutate<ServerCart>('delete', `/cart/items/${productId}`),
  clear: () => apiMutate<ServerCart>('delete', '/cart'),
  /** Merge local (guest) lines into the server cart after login. */
  sync: (items: CartSyncLine[]) => apiMutate<ServerCart>('post', '/cart/sync', { items }),
};
