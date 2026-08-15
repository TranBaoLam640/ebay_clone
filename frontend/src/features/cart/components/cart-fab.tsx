import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../cart-context';
import { CartLine } from './cart-line';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Price } from '@/components/price';
import { EmptyState } from '@/components/empty-state';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { paths } from '@/routes/paths';

/**
 * Floating cart bubble (FAB), pinned bottom-right, shown once the cart has items.
 * - Mobile: the bubble opens a compact popover anchored above it.
 * - Desktop/tablet: the bubble opens the full slide-over <CartDrawer> (shared
 *   `isOpen` state), so the cart stays reachable while scrolling long pages.
 *
 * The bubble is a secondary opener — the header cart icon also toggles the same
 * `isOpen` state, so an empty cart can still be opened from the header.
 */
export function CartFab() {
  const { t } = useTranslation();
  const { isOpen, open, close, items, totalCents, totalItems } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const goCheckout = () => {
    close();
    if (!isAuthenticated) {
      navigate(paths.login, { state: { from: paths.checkout } });
      return;
    }
    navigate(paths.checkout);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  return createPortal(
    <>
    {/* Desktop / tablet: a floating bubble that opens the full slide-over drawer.
        Only shows once the cart has items and the drawer isn't already open, so
        it stays reachable while scrolling long pages. */}
    {totalItems > 0 && !isOpen && (
      <button
        onClick={open}
        className="fixed bottom-6 right-6 z-[90] hidden h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lift transition-transform hover:scale-105 active:scale-95 md:flex"
        aria-label={t('cart.fabLabel', { count: totalItems })}
      >
        <Icon variant="icon-cart" size={24} />
        <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-bold text-white ring-2 ring-bg">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      </button>
    )}

    {/* Container is mobile-only; on md+ the drawer takes over. */}
    <div className="md:hidden">
      {/* Floating bubble — only once there's something in the cart. */}
      {totalItems > 0 && !isOpen && (
        <button
          onClick={open}
          className="fixed bottom-5 right-5 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lift transition-transform active:scale-95"
          aria-label={t('cart.fabLabel', { count: totalItems })}
        >
          <Icon variant="icon-cart" size={24} />
          <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-bold text-white ring-2 ring-bg">
            {totalItems > 99 ? '99+' : totalItems}
          </span>
        </button>
      )}

      {/* Compact popover anchored bottom-right (chat-widget style). */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[94] bg-black/40" onClick={close} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('cart.title')}
            className="fixed bottom-4 right-4 left-4 z-[95] flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="flex items-center gap-2 text-base font-bold text-text">
                <Icon variant="icon-cart" size={18} />
                {t('cart.titleWithCount', { count: totalItems })}
              </h2>
              <button
                onClick={close}
                className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
                aria-label={t('common.close')}
              >
                <Icon variant="icon-close" size={20} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              {items.length === 0 ? (
                <EmptyState
                  icon="icon-cart"
                  title={t('cart.empty')}
                  description={t('cart.emptyDescription')}
                  action={
                    <Link to={paths.products} onClick={close}>
                      <Button variant="secondary">{t('cart.explore')}</Button>
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <CartLine key={item.productId} item={item} />
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <footer className="border-t border-border px-4 py-3">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-sm text-muted">{t('cart.subtotal')}</span>
                  <Price cents={totalCents} className="text-lg" />
                </div>
                <Button fullWidth size="lg" variant="accent" onClick={goCheckout}>
                  {t('cart.checkout')}
                </Button>
              </footer>
            )}
          </div>
        </>
      )}
    </div>
    </>,
    document.body,
  );
}
