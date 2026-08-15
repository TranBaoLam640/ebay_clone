import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'danger' | 'accent' | 'primary';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  accent: 'bg-accent/10 text-accent',
  primary: 'bg-primary/10 text-primary',
};

/** Small uppercase status pill. Pills allowed for tags only (per DESIGN.md). */
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        'uppercase tracking-wide',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
