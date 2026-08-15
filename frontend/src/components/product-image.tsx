import { useState } from 'react';
import { Icon } from './icon';
import { cn } from '@/utils/cn';

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Icon size for the placeholder fallback. */
  iconSize?: number;
  eager?: boolean;
}

/**
 * Product image that gracefully falls back to a package icon when the source is
 * missing OR fails to load (e.g. stale seed URLs that don't resolve). Swallowing
 * the error here keeps a broken-image glyph — and its noisy network error — off
 * the page.
 */
export function ProductImage({ src, alt, className, iconSize = 40, eager }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  if (showFallback) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center bg-surface-2 text-muted', className)}>
        <Icon variant="icon-package" size={iconSize} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
