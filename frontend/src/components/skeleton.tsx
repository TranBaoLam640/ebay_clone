import { cn } from '@/utils/cn';

/** Loading placeholder block with a subtle pulse. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-2', className)} />;
}
