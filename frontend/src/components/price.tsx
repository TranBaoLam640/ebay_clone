import { cn } from '@/utils/cn';
import { formatPrice } from '@/utils/format-price';

interface PriceProps {
  /** Amount in integer VND (đồng) — the backend storage unit. */
  cents: number;
  className?: string;
  /** Emphasize as a sale price using the amber rating/eval color (scarce). */
  sale?: boolean;
}

export function Price({ cents, className, sale = false }: PriceProps) {
  return (
    <span
      className={cn(
        'whitespace-nowrap font-bold tabular-nums',
        sale ? 'text-rating' : 'text-text',
        className,
      )}
    >
      {formatPrice(cents)}
    </span>
  );
}
