import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Price } from '@/components/price';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Skeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { ProductImage } from '@/components/product-image';
import { useToast } from '@/contexts/toast-context';
import { paths } from '@/routes/paths';
import { formatDate } from '@/utils/format-date';
import type { OfferStatus } from '@/features/product-detail/services/auction-api';
import { useMyOffers, useWithdrawOffer } from '../hooks/use-my-offers';

const STATUS_TONE: Record<OfferStatus, 'neutral' | 'success' | 'danger' | 'accent'> = {
  PENDING: 'accent',
  ACCEPTED: 'success',
  DECLINED: 'danger',
  EXPIRED: 'neutral',
  WITHDRAWN: 'neutral',
};

/** My Offers: the buyer's submitted Best Offers with a withdraw action. */
export default function MyOffersPage() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const { data, isLoading } = useMyOffers();
  const withdraw = useWithdrawOffer();

  const onWithdraw = (id: string) => {
    if (!window.confirm(t('myOffers.withdrawConfirm'))) return;
    withdraw.mutate(id, {
      onSuccess: () => notify(t('myOffers.withdrawn'), 'success'),
    });
  };

  if (isLoading)
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );

  if (!data || data.length === 0) return <EmptyState title={t('myOffers.empty')} />;

  const statusLabel: Record<OfferStatus, string> = {
    PENDING: t('myOffers.statusPending'),
    ACCEPTED: t('myOffers.statusAccepted'),
    DECLINED: t('myOffers.statusDeclined'),
    EXPIRED: t('myOffers.statusExpired'),
    WITHDRAWN: t('myOffers.statusWithdrawn'),
  };

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-text">{t('myOffers.title')}</h2>
      <p className="mb-5 text-sm text-muted">{t('myOffers.awaitingNote')}</p>
      <ul className="flex flex-col gap-3">
        {data.map((offer) => (
          <li
            key={offer.id}
            className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-2">
              <ProductImage
                src={offer.productImage}
                alt={offer.productTitle ?? ''}
                iconSize={24}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              {offer.productUuid ? (
                <Link
                  to={paths.product(offer.productUuid)}
                  className="line-clamp-1 font-semibold text-text hover:text-primary"
                >
                  {offer.productTitle}
                </Link>
              ) : (
                <span className="line-clamp-1 font-semibold text-text">
                  {offer.productTitle}
                </span>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                <span>
                  {t('myOffers.amount')}: <Price cents={offer.amount} className="text-sm" />
                </span>
                <span>{t('myOffers.expires', { date: formatDate(offer.expiresAt) })}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Badge tone={STATUS_TONE[offer.status]}>{statusLabel[offer.status]}</Badge>
              {offer.status === 'PENDING' && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={withdraw.isPending}
                  onClick={() => onWithdraw(offer.id)}
                >
                  {t('myOffers.withdraw')}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
