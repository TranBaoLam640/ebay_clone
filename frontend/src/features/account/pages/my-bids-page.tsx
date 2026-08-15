import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Price } from '@/components/price';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Skeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { ProductImage } from '@/components/product-image';
import { paths } from '@/routes/paths';
import { formatPrice } from '@/utils/format-price';
import { cn } from '@/utils/cn';
import type { MyBid } from '@/features/product-detail/services/auction-api';
import { useCountdown } from '@/features/product-detail/hooks/use-countdown';
import { useMyBids } from '../hooks/use-my-bids';

/** My Bids: every auction the buyer has bid on, with a high/outbid colour cue. */
export default function MyBidsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useMyBids();

  if (isLoading)
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );

  if (!data || data.length === 0)
    return <EmptyState title={t('myBids.empty')} />;

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-text">{t('myBids.title')}</h2>
      <ul className="flex flex-col gap-3">
        {data.map((bid) => (
          <MyBidRow key={bid.productUuid} bid={bid} />
        ))}
      </ul>
    </div>
  );
}

function MyBidRow({ bid }: { bid: MyBid }) {
  const { t } = useTranslation();
  const countdown = useCountdown(bid.endsAt);
  const open = bid.status === 'OPEN' && !countdown.ended;

  // Amount colour: green when leading, red when outbid — always paired with a
  // text label (never colour alone) for accessibility.
  const amountTone = bid.youAreHighBidder
    ? 'text-success'
    : open
      ? 'text-danger'
      : 'text-text';

  return (
    <li className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
      <Link
        to={paths.product(bid.productUuid)}
        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-2"
      >
        <ProductImage
          src={bid.productImage}
          alt={bid.productTitle}
          iconSize={24}
          className="h-full w-full object-cover"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={paths.product(bid.productUuid)}
          className="line-clamp-1 font-semibold text-text hover:text-primary"
        >
          {bid.productTitle}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span>
            {t('myBids.yourBid')}:{' '}
            <span className={cn('font-bold tabular-nums', amountTone)}>
              {formatPrice(bid.yourMaxBid)}
            </span>
          </span>
          <span>
            {t('myBids.current')}: <Price cents={bid.currentBid} className="text-sm" />
          </span>
          {open && (
            <span className="tabular-nums">
              {countdown.days > 0 && `${countdown.days}d `}
              {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {bid.won ? (
          <>
            <Badge tone="success">{t('myBids.won')}</Badge>
            <Link to={paths.orders}>
              <Button size="sm" variant="accent">
                {t('myBids.payNow')}
              </Button>
            </Link>
          </>
        ) : bid.youAreHighBidder ? (
          <Badge tone="success">{t('myBids.highest')}</Badge>
        ) : open ? (
          <Badge tone="danger">{t('myBids.outbid')}</Badge>
        ) : bid.endedReserveNotMet ? (
          <Badge tone="neutral">{t('myBids.endedReserveNotMet')}</Badge>
        ) : (
          <Badge tone="neutral">{t('myBids.endedOutbid')}</Badge>
        )}
      </div>
    </li>
  );
}
