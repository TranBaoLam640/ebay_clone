import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../services/checkout-api';
import { orderStatusLabel, orderStatusTone } from '../utils/order-status';
import { Price } from '@/components/price';
import { Button } from '@/components/button';
import { ProductImage } from '@/components/product-image';
import { Skeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { messageFromError } from '@/features/auth/utils/auth-errors';
import { formatDateTime } from '@/utils/format-date';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';

/** Buyer order history — status, total, date; links to each order's detail. */
export default function OrdersPage() {
  const { t } = useTranslation();
  const orders = useQuery({ queryKey: ['orders'], queryFn: ordersApi.list });

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-text">{t('checkout.myOrders')}</h2>

      {orders.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : orders.isError ? (
        <EmptyState
          icon="icon-package"
          title={t('checkout.ordersLoadError')}
          description={messageFromError(orders.error)}
          action={
            <Button variant="secondary" onClick={() => orders.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (orders.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon="icon-package"
          title={t('checkout.noOrdersTitle')}
          description={t('checkout.noOrdersDescription')}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.data!.map((o) => {
            const totalQty = o.items.reduce((s, it) => s + it.quantity, 0);
            const first = o.items[0];
            const extraCount = o.items.length - 1;
            // A short "Item A +2 more" summary makes each order recognizable.
            const itemSummary =
              extraCount > 0
                ? t('checkout.itemsSummary', { title: first?.title ?? '', count: extraCount })
                : (first?.title ?? '');
            return (
              <li key={o.id}>
                <Link
                  to={paths.order(o.id)}
                  className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {/* Thumbnail of the first product — makes orders scannable at a glance. */}
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
                    <ProductImage
                      src={first?.image ?? null}
                      alt={first?.title ?? ''}
                      iconSize={22}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-semibold text-text">
                      {itemSummary || `#${o.id.slice(-8).toUpperCase()}`}
                    </p>
                    <p className="text-xs text-muted">
                      #{o.id.slice(-8).toUpperCase()} · {t('checkout.itemCount', { count: totalQty })}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDateTime(o.createdAt)} · {o.paymentMethod}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Price cents={o.total} className="text-sm" />
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        orderStatusTone(o.orderStatus),
                      )}
                    >
                      {orderStatusLabel(o.orderStatus)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
