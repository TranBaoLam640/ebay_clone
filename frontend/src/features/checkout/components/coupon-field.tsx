import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCouponValidation } from '../hooks/use-checkout';
import { Icon } from '@/components/icon';
import { Button } from '@/components/button';
import { formatPrice } from '@/utils/format-price';
import { messageFromError } from '@/features/auth/utils/auth-errors';

interface CouponFieldProps {
  itemIds: string[];
  appliedCode?: string;
  onApply: (code: string | undefined) => void;
}

/** Enter and validate a coupon; on success it feeds the code back to preview. */
export function CouponField({ itemIds, appliedCode, onApply }: CouponFieldProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const validate = useCouponValidation();

  const apply = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const res = await validate.mutateAsync({ code: trimmed, itemIds });
      onApply(trimmed);
      setFeedback({ ok: true, text: t('checkout.couponApplied', { amount: formatPrice(res.discount) }) });
    } catch (err) {
      onApply(undefined);
      setFeedback({ ok: false, text: messageFromError(err, t('checkout.couponInvalid')) });
    }
  };

  const clear = () => {
    setCode('');
    setFeedback(null);
    onApply(undefined);
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold text-text">
        <Icon variant="icon-tag" size={18} />
        {t('checkout.couponCode')}
      </h2>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          placeholder={t('checkout.couponPlaceholder')}
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3.5 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
        {appliedCode ? (
          <Button variant="secondary" onClick={clear}>
            {t('checkout.couponRemove')}
          </Button>
        ) : (
          <Button onClick={apply} loading={validate.isPending}>
            {t('checkout.couponApply')}
          </Button>
        )}
      </div>
      {feedback && (
        <p className={`mt-2 text-xs ${feedback.ok ? 'text-success' : 'text-danger'}`}>
          {feedback.text}
        </p>
      )}
    </section>
  );
}
