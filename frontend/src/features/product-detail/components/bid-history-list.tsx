import { useTranslation } from 'react-i18next';
import { Price } from '@/components/price';
import { Badge } from '@/components/badge';
import { formatRelative } from '@/utils/format-date';
import { useBidHistory } from '../hooks/use-auction-actions';

/**
 * eBay-style bid history: redacted bidders, counts, per-row amounts. The
 * signed-in viewer's own rows arrive unmasked from the API and are highlighted
 * so they can pick themselves out of the ladder.
 */
export function BidHistoryList({ uuid, enabled }: { uuid: string; enabled: boolean }) {
  const { t } = useTranslation();
  const { data } = useBidHistory(uuid, enabled);

  if (!data || data.bids.length === 0)
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-bold text-text">{t('auction.bidHistory')}</h3>
        <p className="mt-2 text-sm text-muted">{t('auction.noBids')}</p>
      </div>
    );

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-text">{t('auction.bidHistory')}</h3>
        <span className="text-xs text-muted">
          {t('auction.bidders', { count: data.bidderCount })} ·{' '}
          {t('auction.bidCount', { count: data.bidCount })}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {data.bids.map((bid, i) => (
          <li key={`${bid.maskedBidder}-${bid.createdAt}-${i}`} className="flex items-center justify-between py-2">
            <span className="flex items-center gap-2 text-sm text-text">
              <span className={bid.isYou ? 'font-semibold' : 'font-mono'}>{bid.maskedBidder}</span>
              {bid.isYou && <Badge tone="neutral">{t('auction.youShort')}</Badge>}
              {bid.isLeader && <Badge tone="success">{t('auction.highBidderShort')}</Badge>}
            </span>
            <span className="flex items-center gap-3">
              <Price cents={bid.amount} className="text-sm" />
              <span className="text-xs text-muted">{formatRelative(bid.createdAt)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
