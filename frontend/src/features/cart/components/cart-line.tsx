import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CartItem } from '../types/cart.types';
import { useCart } from '../cart-context';
import { lineAvailability } from '../utils/line-availability';
import { Price } from '@/components/price';
import { Icon } from '@/components/icon';
import { ProductImage } from '@/components/product-image';
import { paths } from '@/routes/paths';

/** Single cart row: thumbnail, title, qty stepper, line remove. */
export function CartLine({ item }: { item: CartItem }) {
  const { t } = useTranslation();
  const { setQty, remove, availability } = useCart();

  const { liveStock, issue, blocked } = lineAvailability(item, availability);
  // Out of stock / removed: the line can't be adjusted, only removed.
  const unpurchasable = issue === 'out_of_stock' || issue === 'unavailable';

  return (
    <li className="flex gap-3 py-4">
      <Link
        to={paths.product(item.productId)}
        className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-surface-2"
      >
        <ProductImage
          src={item.image}
          alt={item.title}
          iconSize={24}
          className={`h-full w-full object-cover${unpurchasable ? ' opacity-50' : ''}`}
        />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          to={paths.product(item.productId)}
          className="line-clamp-2 text-sm font-semibold text-text hover:text-primary"
        >
          {item.title}
        </Link>
        <p className="text-xs text-muted">{item.sellerName}</p>
        {/* Price on its own row above the stepper so a long total never collides
            with the +/− controls (narrow popover on mobile). */}
        <Price cents={item.price * item.quantity} className="mt-1 block text-sm" />

        {/* Live-stock warning + fix action. */}
        {issue !== 'none' && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs font-medium text-danger">
              {issue === 'unavailable'
                ? t('cart.stockUnavailable')
                : issue === 'out_of_stock'
                  ? t('cart.stockOutOfStock')
                  : t('cart.stockInsufficient', { count: liveStock })}
            </span>
            {issue === 'insufficient' && (
              <button
                onClick={() => setQty(item.productId, liveStock)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {t('cart.reduceToAvailable', { count: liveStock })}
              </button>
            )}
          </div>
        )}

        {!unpurchasable && (
          <div
            className={`mt-1.5 flex items-center rounded-md border w-fit ${
              blocked ? 'border-danger' : 'border-border'
            }`}
          >
            <button
              // Stepping below 1 removes the line — a natural "empty it out" gesture.
              onClick={() =>
                item.quantity <= 1 ? remove(item.productId) : setQty(item.productId, item.quantity - 1)
              }
              className="flex h-7 w-7 items-center justify-center text-text hover:bg-surface-2 hover:text-danger"
              aria-label={item.quantity <= 1 ? t('cart.removeItem') : t('cart.decreaseQty')}
            >
              <Icon variant="icon-minus" size={14} />
            </button>
            <span className="w-8 text-center text-sm">{item.quantity}</span>
            <button
              onClick={() => setQty(item.productId, item.quantity + 1)}
              disabled={item.quantity >= liveStock}
              className="flex h-7 w-7 items-center justify-center text-text hover:bg-surface-2 disabled:opacity-40"
              aria-label={t('cart.increaseQty')}
            >
              <Icon variant="icon-plus" size={14} />
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => remove(item.productId)}
        className="shrink-0 self-start rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-danger"
        aria-label={t('cart.removeItem')}
      >
        <Icon variant="icon-trash" size={16} />
      </button>
    </li>
  );
}
