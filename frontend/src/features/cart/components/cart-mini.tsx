import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../cart-context';
import { cartHasBlockingIssue } from '../utils/line-availability';
import { useAvailability } from '@/features/catalog/hooks/use-availability';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Icon } from '@/components/icon';
import { Price } from '@/components/price';
import { Button } from '@/components/button';
import { paths } from '@/routes/paths';

const PREVIEW_LIMIT = 4;

/**
 * Desktop mini-cart. Wraps the header cart button: hovering shows a quick
 * preview popover (recent items + subtotal + actions), while clicking the button
 * still opens the full <CartDrawer>. Because it lives inside the sticky header,
 * the popover stays pinned as the page scrolls. Hidden on mobile, where the
 * floating <CartFab> covers this role.
 */
export function CartMini() {
  const { t } = useTranslation();
  const { items, totalItems, totalCents, open } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  // Poll live stock while the popover is shown — shares the query cache with the
  // drawer, so the checkout guard works even when the drawer is never opened.
  const availability = useAvailability(
    items.map((i) => i.productId),
    hovered,
  );
  const blocked = cartHasBlockingIssue(items, availability);

  const preview = items.slice(0, PREVIEW_LIMIT);
  const extra = items.length - preview.length;

  const goCheckout = () => {
    if (blocked) {
      // Push the user into the drawer to resolve the flagged lines first.
      setHovered(false);
      open();
      return;
    }
    setHovered(false);
    navigate(isAuthenticated ? paths.checkout : paths.login, {
      state: isAuthenticated ? undefined : { from: paths.checkout },
    });
  };

  return (
    <div
      className="relative hidden md:block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Click still opens the full drawer. */}
      <button
        onClick={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-md text-text transition-colors hover:bg-surface-2"
        aria-label={t('header.cart')}
      >
        <Icon variant="icon-cart" size={20} />
        {totalItems > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-on-accent">
            {totalItems}
          </span>
        )}
      </button>

      {hovered && (
        // pt-2 bridges the gap so moving the cursor from button to panel keeps
        // the hover alive.
        <div className="absolute right-0 top-full z-40 w-80 pt-2">
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-lift">
            <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="flex items-center gap-2 text-sm font-bold text-text">
                <Icon variant="icon-cart" size={16} />
                {t('cart.titleWithCount', { count: totalItems })}
              </span>
            </header>

            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">{t('cart.empty')}</p>
            ) : (
              <>
                <ul className="max-h-72 divide-y divide-border overflow-y-auto">
                  {preview.map((item) => (
                    <li key={item.productId} className="flex gap-3 px-4 py-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">
                        {item.image ? (
                          <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-muted">
                            <Icon variant="icon-package" size={18} />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-text">{item.title}</p>
                        <p className="text-xs text-muted">
                          {item.quantity} × <Price cents={item.price} className="text-xs" />
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                {extra > 0 && (
                  <p className="px-4 py-2 text-center text-xs text-muted">
                    {t('cart.moreItems', { count: extra })}
                  </p>
                )}

                <footer className="border-t border-border px-4 py-3">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-sm text-muted">{t('cart.subtotal')}</span>
                    <Price cents={totalCents} className="text-base" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setHovered(false);
                        open();
                      }}
                    >
                      {t('cart.viewCart')}
                    </Button>
                    <Button variant="accent" size="sm" className="flex-1" onClick={goCheckout}>
                      {t('cart.checkout')}
                    </Button>
                  </div>
                </footer>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
