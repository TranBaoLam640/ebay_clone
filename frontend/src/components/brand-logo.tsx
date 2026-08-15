import { cn } from '@/utils/cn';

interface BrandLogoProps {
  /** Overall scale. `md` for the header, `sm` for compact spots. */
  size?: 'sm' | 'md' | 'lg';
  /** Hide the "SBay" wordmark and show only the mark (e.g. mobile). */
  markOnly?: boolean;
  className?: string;
}

const MARK_SIZE = { sm: 'h-8 w-8 text-base', md: 'h-9 w-9 text-lg', lg: 'h-11 w-11 text-xl' };
const WORD_SIZE = { sm: 'text-lg', md: 'text-xl', lg: 'text-2xl' };

/**
 * SBay brand lockup: a rounded gradient "S" mark with an amber accent dot, plus
 * the wordmark where "S" carries the accent. Kept as one component so the header,
 * footer, and auth screens stay visually identical.
 */
export function BrandLogo({ size = 'md', markOnly = false, className }: BrandLogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5 font-extrabold text-text', className)}>
      {/* Mark */}
      <span
        className={cn(
          'relative flex items-center justify-center rounded-xl font-black text-on-primary',
          'bg-gradient-to-br from-primary to-[color:var(--grad-c)] shadow-glow',
          MARK_SIZE[size],
        )}
      >
        S
        {/* Amber accent dot — the one warm cue, echoing the rating/price accent. */}
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-[color:var(--c-surface)]" />
      </span>

      {!markOnly && (
        <span className={cn('tracking-tight', WORD_SIZE[size])}>
          <span className="text-accent">S</span>Bay
        </span>
      )}
    </span>
  );
}
