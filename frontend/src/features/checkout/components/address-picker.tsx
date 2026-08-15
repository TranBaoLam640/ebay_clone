import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Address } from '@/features/account/services/address-api';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { cn } from '@/utils/cn';
import { paths } from '@/routes/paths';

interface AddressPickerProps {
  addresses: Address[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Choose the shipping address from the user's saved list. */
export function AddressPicker({ addresses, loading, selectedId, onSelect }: AddressPickerProps) {
  const { t } = useTranslation();

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold text-text">
          <Icon variant="icon-map-pin" size={18} />
          {t('checkout.shippingAddress')}
        </h2>
        <Link
          to={paths.account.addresses}
          className="text-xs font-semibold text-primary hover:underline"
        >
          {t('checkout.manageAddresses')}
        </Link>
      </div>

      {loading ? (
        <Skeleton className="h-20 w-full rounded-lg" />
      ) : addresses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm text-muted">{t('checkout.noAddresses')}</p>
          <Link
            to={paths.account.addresses}
            className="mt-1 inline-block text-sm font-semibold text-primary hover:underline"
          >
            {t('checkout.addAddress')}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {addresses.map((a) => {
            const active = a.id === selectedId;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onSelect(a.id)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg border p-3.5 text-left outline-none transition-colors',
                    active
                      ? 'border-primary bg-primary-soft'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                      active ? 'border-primary' : 'border-border',
                    )}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-text">{a.recipientName}</span>
                      <span className="text-sm text-muted">{a.phone}</span>
                      {a.isDefault && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                          {t('checkout.defaultAddress')}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {a.addressLine}, {a.ward}, {a.district}, {a.province}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
