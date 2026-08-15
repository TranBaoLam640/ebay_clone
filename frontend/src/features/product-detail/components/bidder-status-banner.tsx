import { useTranslation } from 'react-i18next';
import { Icon, type IconVariant } from '@/components/icon';
import { cn } from '@/utils/cn';
import type { AuctionRealtime } from '../hooks/use-auction-realtime';

type Tone = 'success' | 'danger' | 'neutral';

/**
 * eBay-style per-buyer banner at the top of the auction buy column. Colour is
 * always paired with an icon + text label (never colour alone) for a11y.
 */
export function BidderStatusBanner({ auction }: { auction: AuctionRealtime }) {
  const { t } = useTranslation();
  const closed = auction.status === 'CLOSED';

  let tone: Tone | null = null;
  let icon: IconVariant = 'icon-check';
  let label = '';

  if (closed && auction.won) {
    tone = 'success';
    icon = 'icon-check';
    label = t('auction.won');
  } else if (!closed && auction.youAreHighBidder) {
    tone = 'success';
    icon = 'icon-check';
    label = t('auction.highBidder');
  } else if (auction.hasBid && !auction.youAreHighBidder && !auction.won) {
    tone = 'danger';
    icon = 'icon-bell';
    label = t('auction.outbid');
  } else if (closed) {
    tone = 'neutral';
    icon = 'icon-tag';
    label = t('auction.ended');
  }

  if (!tone) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-semibold',
        tone === 'success' && 'border-success/30 bg-success/10 text-success',
        tone === 'danger' && 'border-danger/30 bg-danger/10 text-danger',
        tone === 'neutral' && 'border-border bg-surface-2 text-muted',
      )}
    >
      <Icon variant={icon} size={18} />
      {label}
    </div>
  );
}
