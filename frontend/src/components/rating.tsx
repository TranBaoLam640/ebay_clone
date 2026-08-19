import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { Icon } from './icon';

interface RatingProps {
  value: number | null | undefined;
  count?: number;
  size?: number;
  showValue?: boolean;
  className?: string;
}

/** Read-only star rating. Amber fill for earned stars — the scarce evaluation
 *  cue, kept distinct from the coral CTA color. */
export function Rating({ value, count, size = 16, showValue = false, className }: RatingProps) {
  const { t } = useTranslation();
  const safeValue = typeof value === 'number' ? value : 0;
  const rounded = Math.round(safeValue);
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex text-rating" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Icon key={i} variant={i < rounded ? 'icon-star-fill' : 'icon-star'} size={size} />
        ))}
      </div>
      {showValue && typeof value === 'number' && (
        <span className="text-sm font-semibold text-text">
          {value.toFixed(1)}
        </span>
      )}
      {typeof count === 'number' && (
        <span className="text-sm text-muted">({count})</span>
      )}
      <span className="sr-only">
        {typeof count === 'number'
          ? t('common.ratingWithCount', {
              value: safeValue.toFixed(1),
              count,
            })
          : t('common.rating', { value: safeValue.toFixed(1) })}
      </span>
    </div>
  );
}
