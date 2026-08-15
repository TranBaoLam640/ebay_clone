import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CartItem } from './types/cart.types';
import { cartApi, type ServerCart, type ServerCartItem } from './services/cart-api';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  useAvailability,
  type AvailabilityResult,
} from '@/features/catalog/hooks/use-availability';

/**
 * Hybrid cart.
 * - Guest (not logged in): kept in localStorage — a browsing convenience.
 * - Authenticated: the server cart is the source of truth (React Query), so it
 *   persists across devices. On login, local lines are merged up via /cart/sync
 *   and the local copy is cleared.
 * The public API (items/add/remove/setQty/clear/totals/open/close) is identical
 * for both modes so consumers never branch on auth.
 */

const STORAGE_KEY = 'sbay-cart';
const CART_KEY = ['cart'] as const;

type Action =
  | { type: 'add'; item: CartItem }
  | { type: 'remove'; productId: string }
  | { type: 'setQty'; productId: string; quantity: number }
  | { type: 'clear' }
  | { type: 'hydrate'; items: CartItem[] };

function reducer(state: CartItem[], action: Action): CartItem[] {
  switch (action.type) {
    case 'hydrate':
      return action.items;
    case 'add': {
      const existing = state.find((i) => i.productId === action.item.productId);
      if (existing) {
        return state.map((i) =>
          i.productId === action.item.productId
            ? { ...i, quantity: Math.min(i.stock, i.quantity + action.item.quantity) }
            : i,
        );
      }
      return [...state, action.item];
    }
    case 'remove':
      return state.filter((i) => i.productId !== action.productId);
    case 'setQty':
      return state.map((i) =>
        i.productId === action.productId
          ? { ...i, quantity: Math.max(1, Math.min(i.stock, action.quantity)) }
          : i,
      );
    case 'clear':
      return [];
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  totalCents: number;
  isOpen: boolean;
  /** True while a server cart mutation is in flight (authenticated mode). */
  isSyncing: boolean;
  /** Live stock/status for the cart lines, polled while the cart is open. */
  availability: AvailabilityResult;
  open: () => void;
  close: () => void;
  add: (item: CartItem) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadLocal(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

/** Map a server cart line to the shared CartItem shape used across the UI. */
function toCartItem(line: ServerCartItem): CartItem {
  return {
    productId: line.productId,
    title: line.product.title,
    price: line.product.price,
    image: line.product.primaryImage,
    sellerName: line.product.seller.displayName,
    quantity: line.quantity,
    stock: line.product.stock,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [localItems, dispatch] = useReducer(reducer, [], loadLocal);
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncedRef = useRef(false);

  // Persist the guest cart.
  useEffect(() => {
    if (!isAuthenticated) localStorage.setItem(STORAGE_KEY, JSON.stringify(localItems));
  }, [localItems, isAuthenticated]);

  // Server cart (only fetched when authenticated).
  const serverCartQuery = useQuery({
    queryKey: CART_KEY,
    queryFn: cartApi.get,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const setServerCart = useCallback(
    (cart: ServerCart) => qc.setQueryData(CART_KEY, cart),
    [qc],
  );

  // Offline support for the authenticated cart: when a server mutation fails
  // (e.g. no network), we keep an optimistic cache and flag the cart dirty, then
  // push the full cart via /cart/sync once the browser reports it's online.
  const [offlineDirty, setOfflineDirty] = useState(false);

  /** Recompute cart totals after an in-place optimistic change to its items. */
  const recompute = (cart: ServerCart): ServerCart => ({
    ...cart,
    items: cart.items.map((line) => ({
      ...line,
      itemSubtotal: line.product.price * line.quantity,
    })),
    subtotal: cart.items.reduce((s, l) => s + l.product.price * l.quantity, 0),
    totalQuantity: cart.items.reduce((s, l) => s + l.quantity, 0),
  });

  // On login: merge local lines into the server cart once, then clear local.
  useEffect(() => {
    if (!isAuthenticated) {
      syncedRef.current = false;
      return;
    }
    if (syncedRef.current) return;
    syncedRef.current = true;

    const pending = loadLocal();
    (async () => {
      try {
        if (pending.length > 0) {
          setIsSyncing(true);
          const merged = await cartApi.sync(
            pending.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          );
          setServerCart(merged);
          localStorage.removeItem(STORAGE_KEY);
          dispatch({ type: 'clear' });
        }
      } catch {
        // Sync failure is non-fatal — the server cart still loads on its own.
      } finally {
        setIsSyncing(false);
      }
    })();
  }, [isAuthenticated, setServerCart]);

  const serverItems = useMemo(
    () => (serverCartQuery.data?.items ?? []).map(toCartItem),
    [serverCartQuery.data],
  );

  const items = isAuthenticated ? serverItems : localItems;

  // Live stock for the cart lines — polled only while the drawer/popover is open
  // so a closed cart makes no background requests.
  const itemIds = useMemo(() => items.map((i) => i.productId), [items]);
  const availability = useAvailability(itemIds, isOpen);

  // When the cart is dirty from an offline change, push it up as soon as the
  // browser is online again (and retry on future 'online' events).
  useEffect(() => {
    if (!isAuthenticated || !offlineDirty) return;
    const flush = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const cart = qc.getQueryData<ServerCart>(CART_KEY);
      if (!cart) return;
      try {
        setIsSyncing(true);
        const synced = await cartApi.sync(
          cart.items.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        );
        setServerCart(synced);
        setOfflineDirty(false);
      } catch {
        // Still offline / server unreachable — stay dirty, try again next event.
      } finally {
        setIsSyncing(false);
      }
    };
    void flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [isAuthenticated, offlineDirty, qc, setServerCart]);

  /**
   * Run a server cart mutation with an optimistic cache update. On failure
   * (offline), the optimistic cache is kept and the cart is flagged dirty so it
   * syncs when the browser comes back online — the UI stays responsive offline.
   */
  const runServer = useCallback(
    async (optimistic: (cart: ServerCart) => ServerCart, op: () => Promise<ServerCart>) => {
      const prev = qc.getQueryData<ServerCart>(CART_KEY);
      if (prev) setServerCart(recompute(optimistic(prev)));
      setIsSyncing(true);
      try {
        setServerCart(await op());
        setOfflineDirty(false);
      } catch {
        // Keep the optimistic cart and defer to the online-sync effect.
        setOfflineDirty(true);
      } finally {
        setIsSyncing(false);
      }
    },
    [qc, setServerCart],
  );

  const add = useCallback(
    (item: CartItem) => {
      if (!isAuthenticated) {
        dispatch({ type: 'add', item });
        return;
      }
      void runServer(
        (cart) => {
          const existing = cart.items.find((l) => l.productId === item.productId);
          if (existing) {
            return {
              ...cart,
              items: cart.items.map((l) =>
                l.productId === item.productId
                  ? { ...l, quantity: Math.min(l.product.stock, l.quantity + item.quantity) }
                  : l,
              ),
            };
          }
          // New line: synthesize a minimal snapshot from the CartItem.
          return {
            ...cart,
            items: [
              ...cart.items,
              {
                id: item.productId,
                productId: item.productId,
                quantity: item.quantity,
                itemSubtotal: item.price * item.quantity,
                product: {
                  id: item.productId,
                  title: item.title,
                  primaryImage: item.image,
                  price: item.price,
                  stock: item.stock,
                  status: 'ACTIVE',
                  seller: { id: '', displayName: item.sellerName },
                },
              },
            ],
          };
        },
        () => cartApi.addItem(item.productId, item.quantity),
      );
    },
    [isAuthenticated, runServer],
  );

  const remove = useCallback(
    (productId: string) => {
      if (!isAuthenticated) {
        dispatch({ type: 'remove', productId });
        return;
      }
      void runServer(
        (cart) => ({ ...cart, items: cart.items.filter((l) => l.productId !== productId) }),
        () => cartApi.removeItem(productId),
      );
    },
    [isAuthenticated, runServer],
  );

  const setQty = useCallback(
    (productId: string, quantity: number) => {
      if (!isAuthenticated) {
        dispatch({ type: 'setQty', productId, quantity });
        return;
      }
      void runServer(
        (cart) => ({
          ...cart,
          items: cart.items.map((l) =>
            l.productId === productId
              ? { ...l, quantity: Math.max(1, Math.min(l.product.stock, quantity)) }
              : l,
          ),
        }),
        () => cartApi.setQuantity(productId, quantity),
      );
    },
    [isAuthenticated, runServer],
  );

  const clear = useCallback(() => {
    if (!isAuthenticated) {
      dispatch({ type: 'clear' });
      return;
    }
    void runServer(
      (cart) => ({ ...cart, items: [] }),
      () => cartApi.clear(),
    );
  }, [isAuthenticated, runServer]);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalCents = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalItems,
      totalCents,
      isOpen,
      isSyncing,
      availability,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add,
      remove,
      setQty,
      clear,
    }),
    [items, totalItems, totalCents, isOpen, isSyncing, availability, add, remove, setQty, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
