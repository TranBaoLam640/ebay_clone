import { useState } from 'react';
import { cn } from '@/utils/cn';
import { Icon } from '@/components/icon';

/** Product image gallery: large preview + thumbnail strip. */
export function ImageGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const hasImages = images.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">
        {hasImages ? (
          <img src={images[active]} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <Icon variant="icon-package" size={64} />
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                'h-16 w-16 shrink-0 overflow-hidden rounded-md border-2',
                i === active ? 'border-primary' : 'border-border',
              )}
              aria-label={`Ảnh ${i + 1}`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
