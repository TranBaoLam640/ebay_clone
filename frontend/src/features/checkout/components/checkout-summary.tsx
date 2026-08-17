import { useTranslation } from 'react-i18next';
import type { CheckoutPreview } from '../services/checkout-api';
import { Price } from '@/components/price';
import { Button } from '@/components/button';
import { Skeleton } from '@/components/skeleton';
import { ProductImage } from '@/components/product-image';

interface CheckoutSummaryProps {
  preview: CheckoutPreview | undefined;
  loading: boolean;
  error: string | null;
  placing: boolean;
  canPlace: boolean;
  onPlace: () => void;
}

/** Right-rail order summary: items, totals, warnings, place-order CTA. */
export function CheckoutSummary({
  preview,
  loading,
  error,
  placing,
  canPlace,
  onPlace,
}: CheckoutSummaryProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-4 font-bold text-text">{t('checkout.orderSummary')}</h2>

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : loading || !preview ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <>
          <ul className="mb-4 flex flex-col gap-3">
            {preview.selectedItems.map((item) => (
              <li key={item.id} className="flex gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-2">
                  <ProductImage
                    src={item.product.primaryImage}
                    alt={item.product.title}
                    iconSize={20}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-text">{item.product.title}</p>
                  <p className="text-xs text-muted">x{item.quantity}</p>
                  {preview.offer && (
                    <p className="mt-1 text-xs text-muted">
                      Original: <Price cents={preview.offer.originalPrice} /> · Accepted offer:{' '}
                      <Price cents={preview.offer.finalPrice} />
                    </p>
                  )}
                </div>
                <Price cents={item.itemSubtotal} className="shrink-0 text-sm" />
              </li>
            ))}
          </ul>

          {preview.stockWarnings.length > 0 && (
            <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {preview.stockWarnings.map((w) => (
                <p key={w.productId}>{w.message}</p>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
            <Row label={t('checkout.subtotal')} value={preview.subtotal} />
            {preview.discount > 0 && (
              <Row label={t('checkout.discount')} value={-preview.discount} accent />
            )}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
              <span className="font-semibold text-text">{t('checkout.total')}</span>
              <Price cents={preview.total} className="text-xl" />
            </div>
          </div>
        </>
      )}

      <Button
        fullWidth
        size="lg"
        variant="accent"
        className="mt-5"
        loading={placing}
        disabled={!canPlace || loading || placing}
        onClick={onPlace}
      >
        {t('checkout.placeOrder')}
      </Button>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={accent ? 'font-medium text-success' : 'text-text'}>
        {value < 0 ? '−' : ''}
        {formatValue(Math.abs(value))}
      </span>
    </div>
  );
}

function formatValue(cents: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(cents);
}
