import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface SectionProps {
  children: ReactNode;
  /** Adds a tinted background (alternating rhythm between sections). */
  tinted?: boolean;
  /**
   * Fill at least one viewport and vertically center the content. Long content
   * (e.g. product grids) is allowed to grow taller — it is never clipped.
   */
  screen?: boolean;
  className?: string;
  id?: string;
}

/**
 * Standard page section. Provides the shared shell so every block lines up:
 *  - full-bleed background (optional tint) with a centered 1280px container
 *  - a 12-column grid children can span with col-span-* (bootstrap-style)
 *  - optional min-h-screen with vertical centering for a "one screen" feel
 */
export function Section({ children, tinted, screen, className, id }: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'w-full',
        tinted && 'bg-surface-2/50',
        screen && 'flex min-h-screen flex-col justify-center',
        className,
      )}
    >
      <div className="mx-auto grid w-full max-w-[1280px] grid-cols-12 gap-x-6 gap-y-6 px-4 py-10 md:py-12">
        {children}
      </div>
    </section>
  );
}
