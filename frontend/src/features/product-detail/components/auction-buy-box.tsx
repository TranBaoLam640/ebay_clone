import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { Price } from '@/components/price';
import { Icon } from '@/components/icon';
import { useToast } from '@/contexts/toast-context';
import { ApiError } from '@/services/types';
import { paths } from '@/routes/paths';
import { formatPrice, formatNumber } from '@/utils/format-price';
import { cn } from '@/utils/cn';
import type { AuctionRealtime } from '../hooks/use-auction-realtime';
import { usePlaceBid, useBuyNow } from '../hooks/use-auction-actions';
import { useCountdown } from '../hooks/use-countdown';

interface Props {
  uuid: string;
  auction: AuctionRealtime;
  isAuthenticated: boolean;
}

/** Auction buy box: live current bid, countdown, proxy max-bid input, Buy It Now. */
export function AuctionBuyBox({ uuid, auction, isAuthenticated }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notify } = useToast();
  const countdown = useCountdown(auction.endsAt);
  const placeBid = usePlaceBid(uuid);
  const buyNow = useBuyNow(uuid);

  const [value, setValue] = useState('');
  const [minError, setMinError] = useState<number | null>(null);

  // Group digits with dots as the user types (2000 → 2.000, 2000000 → 2.000.000).
  const handleValueChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    setValue(digits ? formatNumber(Number(digits)) : '');
  };

  const closed = auction.status === 'CLOSED' || countdown.ended;
  const open = auction.status === 'OPEN' && !countdown.ended;

  const submitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setMinError(null);
    const maxBid = Number(value.replace(/\D/g, ''));
    if (!Number.isFinite(maxBid) || maxBid <= 0) return;
    try {
      const result = await placeBid.mutateAsync(maxBid);
      setValue('');
      notify(
        result.outcome === 'LEADING'
          ? t('auction.bidPlacedLeading')
          : t('auction.bidPlacedOutbid'),
        result.outcome === 'LEADING' ? 'success' : 'error',
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === 'BID_TOO_LOW') {
        // The backend attaches { minRequired } as the error detail payload.
        const min =
          (err.details as unknown as { minRequired?: number } | undefined)
            ?.minRequired ?? null;
        setMinError(min);
      } else if (err instanceof ApiError) {
        notify(err.message, 'error');
      }
    }
  };

  const confirmBuyNow = async () => {
    if (!window.confirm(t('auction.buyNowConfirm', { amount: formatPrice(auction.buyNowPrice ?? 0) })))
      return;
    try {
      const result = await buyNow.mutateAsync();
      notify(t('auction.buyNowSuccess'), 'success');
      // Buy It Now created a PENDING_PAYMENT order — send the buyer straight to
      // checkout (pick address + pay), the same as eBay's Buy It Now flow.
      navigate(result.orderId ? paths.orderCheckout(result.orderId) : paths.orders);
    } catch (err) {
      if (err instanceof ApiError) notify(t('auction.buyNowGone'), 'error');
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      {/* Current bid + reserve chip */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-muted">
            {closed ? t('auction.finalPrice') : t('auction.currentBid')}
          </span>
          {auction.hasReserve && (
            <Badge tone={auction.reserveMet ? 'success' : 'neutral'}>
              {auction.reserveMet ? t('auction.reserveMet') : t('auction.reserveNotMet')}
            </Badge>
          )}
        </div>
        <Price
          cents={closed ? (auction.finalPrice ?? auction.currentBid) : auction.currentBid}
          className="text-3xl"
        />
        <p className="mt-1 text-sm text-muted">
          {t('auction.bidCount', { count: auction.bidCount })}
        </p>
        {/* Your proxy ceiling — shown only while you lead. Once outbid beyond your
            max the proxy is spent, so we hide it (the Outbid banner takes over). */}
        {auction.youAreHighBidder && auction.yourMaxBid != null && (
          <p className="mt-1 text-sm font-medium text-success">
            {t('auction.yourMaxBidValue', {
              amount: formatPrice(auction.yourMaxBid),
            })}
            <span className="font-normal text-muted">
              {' · '}
              {auction.yourMaxBid > auction.currentBid
                ? t('auction.autobidActive')
                : t('auction.atYourMax')}
            </span>
          </p>
        )}
      </div>

      {/* Countdown */}
      <div className="flex items-center gap-2 text-sm">
        <Icon variant="icon-tag" size={16} />
        {closed ? (
          <span className="font-semibold text-muted">{t('auction.ended')}</span>
        ) : (
          <span className="font-semibold text-text">
            {t('auction.timeLeft')}:{' '}
            <span className="tabular-nums">
              {countdown.days > 0 && `${countdown.days}d `}
              {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
            </span>
          </span>
        )}
      </div>

      {/* Won → pay. The win order lives under Orders (a PENDING_PAYMENT order);
          the buyer completes checkout there. */}
      {closed && auction.won && (
        <Link to={paths.orders}>
          <Button variant="accent" size="lg" fullWidth>
            {t('auction.wonPayNow')}
          </Button>
        </Link>
      )}

      {/* Bidding form */}
      {open && (
        <>
          {!isAuthenticated ? (
            <Link to={paths.login}>
              <Button variant="accent" size="lg" fullWidth>
                {t('auction.signInToBid')}
              </Button>
            </Link>
          ) : (
            <form onSubmit={submitBid} className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text" htmlFor="max-bid">
                {t('auction.maxBid')}
              </label>
              <div className="flex items-stretch gap-2">
                <input
                  id="max-bid"
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder={t('auction.minBidPlaceholder', {
                    amount: formatPrice(auction.minNextBid),
                  })}
                  className={cn(
                    'h-12 min-w-0 flex-1 rounded-md border bg-surface px-3 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    minError ? 'border-danger' : 'border-border',
                  )}
                />
                <Button
                  type="submit"
                  variant="accent"
                  size="lg"
                  loading={placeBid.isPending}
                  className="shrink-0"
                >
                  {t('auction.placeBid')}
                </Button>
              </div>
              <p className="text-xs text-muted">
                {t('auction.minNext', { amount: formatPrice(auction.minNextBid) })}
              </p>
              {minError !== null && (
                <p className="text-sm font-medium text-danger">
                  {t('auction.bidTooLow', { min: formatPrice(minError) })}
                </p>
              )}
            </form>
          )}

          {/* Buy It Now — gone with the first bid, except on a reserve listing,
              where it stays until a bid meets the reserve. */}
          {auction.buyNowAvailable && auction.buyNowPrice != null && (
            <div className="border-t border-border pt-3">
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={confirmBuyNow}
                loading={buyNow.isPending}
                disabled={!isAuthenticated}
              >
                <Icon variant="icon-cart" size={18} />
                {t('auction.buyNow', { amount: formatPrice(auction.buyNowPrice) })}
              </Button>
              {auction.hasReserve && (
                <p className="mt-2 text-xs text-muted">
                  {t('auction.buyNowUntilReserve')}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
