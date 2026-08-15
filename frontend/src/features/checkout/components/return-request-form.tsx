import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { RETURN_REASONS, type ReturnReason } from '../services/return-api';
import type { OrderItem } from '../services/checkout-api';
import { Select } from '@/components/select';
import { Input } from '@/components/input';
import { Textarea } from '@/components/textarea';
import { Button } from '@/components/button';

export interface ReturnFormValue {
  orderItemId: string;
  quantity: number;
  reason: ReturnReason;
  details?: string;
}

interface ReturnRequestFormProps {
  /** Items of the order — the buyer picks which one to return. */
  items: OrderItem[];
  submitting?: boolean;
  onSubmit: (value: ReturnFormValue) => void;
  onCancel: () => void;
}

const MAX_DETAILS = 1000;

/** Pick an item + reason (+ quantity) to return. One request per order. */
export function ReturnRequestForm({ items, submitting, onSubmit, onCancel }: ReturnRequestFormProps) {
  const { t } = useTranslation();
  const [orderItemId, setOrderItemId] = useState(items[0]?.id ?? '');
  const [reason, setReason] = useState<ReturnReason>('DAMAGED');
  const [quantity, setQuantity] = useState(1);
  const [details, setDetails] = useState('');

  const selectedItem = useMemo(
    () => items.find((it) => it.id === orderItemId) ?? items[0],
    [items, orderItemId],
  );
  const maxQuantity = selectedItem?.quantity ?? 1;

  const itemOptions = items.map((it) => ({
    value: it.id,
    label: it.title ?? t('checkout.items'),
  }));

  const reasonOptions = RETURN_REASONS.map((r) => ({
    value: r,
    label: t(`returns.reason.${r}`),
  }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = details.trim();
    onSubmit({
      orderItemId,
      // Clamp to [1, maxQuantity] — the item may have changed to one with fewer
      // units, or the number field may be empty/0 at submit time.
      quantity: Math.min(Math.max(1, quantity || 1), maxQuantity),
      reason,
      details: trimmed || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {items.length > 1 && (
        <Select
          label={t('returns.itemLabel')}
          options={itemOptions}
          value={orderItemId}
          onValueChange={(v) => {
            setOrderItemId(v);
            setQuantity(1);
          }}
        />
      )}

      <Select
        label={t('returns.reasonLabel')}
        options={reasonOptions}
        value={reason}
        onValueChange={(v) => setReason(v as ReturnReason)}
      />

      {maxQuantity > 1 && (
        <Input
          label={t('returns.quantityLabel')}
          type="number"
          inputMode="numeric"
          min={1}
          max={maxQuantity}
          value={quantity}
          hint={t('returns.quantityMax', { count: maxQuantity })}
          onChange={(e) => {
            // Allow the field to be briefly empty while typing; clamp on blur.
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            setQuantity(n);
          }}
          onBlur={() => setQuantity((q) => Math.min(maxQuantity, Math.max(1, q || 1)))}
        />
      )}

      <Textarea
        label={t('returns.detailsLabel')}
        placeholder={t('returns.detailsPlaceholder')}
        value={details}
        maxLength={MAX_DETAILS}
        onChange={(e) => setDetails(e.target.value)}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('returns.cancel')}
        </Button>
        <Button type="submit" loading={submitting}>
          {t('returns.submit')}
        </Button>
      </div>
    </form>
  );
}
