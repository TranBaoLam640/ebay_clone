import { Link } from 'react-router-dom';
import type { ProductListItem } from '../types/catalog.types';
import { paths } from '@/routes/paths';
import { Price } from '@/components/price';
import { Rating } from '@/components/rating';
import { Icon } from '@/components/icon';
import { ProductImage } from '@/components/product-image';
import { useCart } from '@/features/cart/cart-context';
import { useToast } from '@/contexts/toast-context';
import { useTranslation } from 'react-i18next';

/** Product tile: image, title, rating, price, seller, quick add-to-cart. */
export function ProductCard({ product }: { product: ProductListItem }) {
  const { t } = useTranslation();
  const isAuction = product.listingType === 'AUCTION';
  const outOfStock = product.status === 'OUT_OF_STOCK' || product.stock <= 0;
  const { add } = useCart();
  const { notify } = useToast();

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    add({
      productId: product.id,
      title: product.title,
      price: product.price,
      image: product.primaryImage,
      sellerName: product.seller.displayName,
      quantity: 1,
      stock: product.stock,
    });
    notify(t('cart.addedToCart'), 'success');
  };

  return (
    <Link
      to={paths.product(product.id)}
      className="reveal-init group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface outline-none transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <div className="relative aspect-square overflow-hidden bg-surface-2">
        <ProductImage
          src={product.primaryImage}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        {isAuction && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-accent px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-on-accent shadow-sm">
            {t('product.auctionBadge')}
          </span>
        )}

        {/* Best-Offer items (FIXED + offersEnabled) — never auctions. Hidden when
            out of stock so it doesn't collide with the out-of-stock badge. */}
        {!isAuction && product.offersEnabled && !outOfStock && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-primary px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-on-primary shadow-sm">
            {t('product.offersBadge')}
          </span>
        )}

        {outOfStock && (
          <>
            {/* Dim the image so the badge reads on any photo. */}
            <div className="absolute inset-0 bg-white/45 dark:bg-black/45" />
            <span className="absolute left-2.5 top-2.5 rounded-md bg-danger px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
              {t('product.outOfStock')}
            </span>
          </>
        )}

        {/* Quick add — never on auctions (they sell through bidding, not the
            cart). Mobile gets a round icon button; sm+ gets the sliding label. */}
        {!outOfStock && !isAuction && (
          <>
            <button
              onClick={quickAdd}
              className="absolute bottom-2.5 right-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-on-accent shadow-lift transition-transform active:scale-90 sm:hidden"
              aria-label={t('product.addToCart')}
            >
              <Icon variant="icon-cart" size={18} />
            </button>
            <button
              onClick={quickAdd}
              className="absolute inset-x-2.5 bottom-2.5 hidden h-10 translate-y-[130%] items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-on-accent opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 sm:flex"
            >
              <Icon variant="icon-cart" size={16} />
              {t('product.addToCart')}
            </button>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-text transition-colors group-hover:text-primary">
          {product.title}
        </h3>
        <Rating value={product.averageRating} count={product.reviewCount} size={14} />
        <div className="mt-auto min-w-0 pt-1">
          {/* Reserve one line for the label on every card (empty for fixed-price)
              so the price baseline stays aligned across auction/non-auction tiles
              sitting side by side in the grid. */}
          <span className="block h-4 text-[11px] font-medium uppercase leading-4 tracking-wide text-muted">
            {isAuction ? t('product.startingBid') : ''}
          </span>
          {/* Keep the price on one line; scale it down on mobile so even long
              (billion-VND) prices fit without wrapping or breaking the layout. */}
          <Price
            cents={product.price}
            className="block truncate text-sm leading-tight sm:text-base"
          />
        </div>
        <p className="flex min-w-0 items-center gap-1 text-xs text-muted">
          <Icon variant="icon-shield" size={12} className="shrink-0" />
          <span className="truncate">{product.seller.displayName}</span>
        </p>
      </div>
    </Link>
  );
}
