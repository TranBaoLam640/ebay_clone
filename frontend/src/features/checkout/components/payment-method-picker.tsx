import { useTranslation } from 'react-i18next';
import type { PaymentMethod } from '../services/checkout-api';
import { Icon, type IconVariant } from '@/components/icon';
import { cn } from '@/utils/cn';

interface PaymentMethodPickerProps {
  /** Methods the server advertises for this checkout (falls back to COD only). */
  available: PaymentMethod[];
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}

const META: Record<PaymentMethod, { icon: IconVariant; labelKey: string; descKey: string }> = {
  COD: { icon: 'icon-truck', labelKey: 'checkout.codLabel', descKey: 'checkout.codDescription' },
  PAYPAL: { icon: 'icon-lock', labelKey: 'checkout.paypalLabel', descKey: 'checkout.paypalDescription' },
};

/** Radio-style selector for the checkout payment method. */
export function PaymentMethodPicker({ available, selected, onSelect }: PaymentMethodPickerProps) {
  const { t } = useTranslation();
  // Keep a stable order; only render methods the server allows.
  const methods = (['COD', 'PAYPAL'] as PaymentMethod[]).filter((m) => available.includes(m));

  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={t('checkout.paymentMethod')}>
      {methods.map((method) => {
        const meta = META[method];
        const active = method === selected;
        return (
          <button
            key={method}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(method)}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
              'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
              active ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/40',
            )}
          >
            <Icon variant={meta.icon} size={20} className={active ? 'text-primary' : 'text-muted'} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">{t(meta.labelKey)}</p>
              <p className="text-xs text-muted">{t(meta.descKey)}</p>
            </div>
            <span
              className={cn(
                'h-4 w-4 shrink-0 rounded-full border-2',
                active ? 'border-primary bg-primary' : 'border-border',
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
