import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../cart-context';
import { CartLine } from './cart-line';
import { cartHasBlockingIssue } from '../utils/line-availability';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Price } from '@/components/price';
import { EmptyState } from '@/components/empty-state';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { lockScroll, unlockScroll } from '@/hooks/scroll-lock';
import { paths } from '@/routes/paths';

/** Slide-over cart with a real checkout hand-off (login-gated). */
export function CartDrawer() {
  const { t } = useTranslation();
  const { isOpen, close, items, totalCents, totalItems, availability } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const blocked = cartHasBlockingIssue(items, availability);

  const goCheckout = () => {
    if (blocked) return;
    close();
    // Checkout needs the server cart → require login; come back after auth.
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
    lockScroll(); // pause Lenis + pin the page behind the drawer
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockScroll();
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return createPortal(
    // Desktop / tablet slide-over. On mobile the <CartFab> popover takes over.
    <div className="fixed inset-0 z-[95] hidden md:block" role="dialog" aria-modal="true" aria-label={t('cart.title')}>
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-surface shadow-xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-text">
            <Icon variant="icon-cart" size={20} />
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

        <div className="flex-1 overflow-y-auto px-5">
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
          <footer className="border-t border-border px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted">{t('cart.subtotal')}</span>
              <Price cents={totalCents} className="text-xl" />
            </div>
            {blocked && (
              <p className="mb-2 text-center text-xs font-medium text-danger">
                {t('cart.resolveIssuesToCheckout')}
              </p>
            )}
            <Button fullWidth size="lg" variant="accent" onClick={goCheckout} disabled={blocked}>
              {t('cart.checkout')}
            </Button>
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}
