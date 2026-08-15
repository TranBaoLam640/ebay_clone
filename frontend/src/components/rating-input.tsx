import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { Icon } from './icon';

interface RatingInputProps {
  value: number;
  onChange: (value: number) => void;
  size?: number;
  className?: string;
  disabled?: boolean;
}

/** Interactive 1–5 star picker. Hover previews, click commits; keyboard-accessible. */
export function RatingInput({ value, onChange, size = 28, className, disabled }: RatingInputProps) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className={cn('flex items-center gap-1', className)} onMouseLeave={() => setHover(0)}>
      {Array.from({ length: 5 }, (_, i) => {
        const star = i + 1;
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            aria-label={t('common.rateStars', { count: star })}
            aria-pressed={value === star}
            className={cn(
              'rounded p-0.5 text-rating transition-transform focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
              !disabled && 'hover:scale-110',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <Icon variant={star <= shown ? 'icon-star-fill' : 'icon-star'} size={size} />
          </button>
        );
      })}
    </div>
  );
}
