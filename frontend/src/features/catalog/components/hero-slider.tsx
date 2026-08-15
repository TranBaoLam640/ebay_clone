import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProducts } from '../hooks/use-catalog';
import type { ProductListItem } from '../types/catalog.types';
import { paths } from '@/routes/paths';
import { Button } from '@/components/button';
import { Price } from '@/components/price';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { useDeviceTier } from '@/hooks/use-device-tier';
import { cn } from '@/utils/cn';

const AUTOPLAY_MS = 5000;

// Fallback gradient wash per slide, used only when a product has no image so
// each promo still feels distinct (backend has no banner API yet).
const GRADIENTS = [
  'from-primary to-[color:var(--grad-c)]',
  'from-[color:var(--grad-c)] to-primary',
  'from-primary/90 to-accent/70',
  'from-[color:var(--grad-a)] to-primary',
];

/**
 * Full-width promotional carousel built from top-rated products. Auto-advances
 * (paused on hover / when tab hidden / reduced-motion), with dots and prev/next
 * controls. Uses a plain state index + CSS transform track — no heavy library.
 */
export function HeroSlider() {
  const { t } = useTranslation();
  const tier = useDeviceTier();
  const { data, isLoading } = useProducts({ sort: 'rating_desc', limit: 5 });
  const slides = data?.items ?? [];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  const go = useCallback((next: number) => setIndex(() => (count ? (next + count) % count : 0)), [count]);

  // Touch swipe (mobile has no prev/next arrows). Horizontal drag past a small
  // threshold advances the slide; direction decides prev vs next.
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  // Auto-play. Respects reduced-motion/low tier and pauses on hover/hidden tab.
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (tier === 'low' || paused || count <= 1) return;
    timer.current = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(timer.current);
  }, [tier, paused, count]);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 pt-6">
        <Skeleton className="h-[440px] w-full rounded-2xl md:h-[560px]" />
      </div>
    );
  }
  if (count === 0) return null;

  return (
    <section
      className="mx-auto max-w-[1280px] px-4 pt-6"
      aria-roledescription="carousel"
      aria-label={t('hero.carouselLabel')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="relative touch-pan-y overflow-hidden rounded-2xl border border-border shadow-card"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Track */}
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((p, i) => (
            <Slide key={p.id} product={p} gradient={GRADIENTS[i % GRADIENTS.length]} />
          ))}
        </div>

        {/* Prev / Next */}
        {count > 1 && (
          <>
            <SliderArrow side="left" onClick={() => go(index - 1)} />
            <SliderArrow side="right" onClick={() => go(index + 1)} />
          </>
        )}

        {/* Dots */}
        {count > 1 && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={t('hero.slideLabel', { index: i + 1 })}
                aria-current={i === index}
                className={cn(
                  'h-2 rounded-full bg-white/60 outline-none transition-all focus-visible:ring-2 focus-visible:ring-white',
                  i === index ? 'w-6 bg-white' : 'w-2 hover:bg-white/80',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Slide({ product, gradient }: { product: ProductListItem; gradient: string }) {
  const { t } = useTranslation();
  const image = product.primaryImage;
  const hasImage = Boolean(image);
  return (
    <div className="w-full shrink-0">
      <div className={cn('relative min-h-[440px] md:min-h-[560px]', !hasImage && 'bg-gradient-to-br', gradient)}>
        {/* Background image fills the whole slide. */}
        {image && (
          <img
            src={image}
            alt={product.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
        )}

        {/* Scrim: darkens the image toward the left so overlaid white text keeps
            WCAG AA contrast regardless of the underlying photo. */}
        <div
          className={cn(
            'absolute inset-0',
            hasImage
              ? 'bg-gradient-to-r from-black/80 via-black/55 to-black/10 md:to-transparent'
              : 'bg-black/10',
          )}
        />

        {/* Copy overlaid on the image. */}
        <div className="relative flex min-h-[440px] items-center px-6 py-10 md:min-h-[560px] md:px-14">
          <div className="flex max-w-xl flex-col gap-4 text-white">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur-sm ring-1 ring-white/20">
              <Icon variant="icon-sparkles" size={14} />
              {t('hero.badge')}
            </span>
            <h2 className="text-3xl font-extrabold leading-[1.1] tracking-tight drop-shadow-sm md:text-5xl">
              {product.title}
            </h2>
            <div className="flex items-center gap-4">
              <Price cents={product.price} className="text-3xl font-bold text-white md:text-4xl" />
              {product.reviewCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-sm text-white backdrop-blur-sm">
                  <Icon variant="icon-star-fill" size={14} className="text-rating" />
                  {product.averageRating.toFixed(1)}
                </span>
              )}
            </div>
            <p className="text-sm text-white/80">{t('hero.from', { seller: product.seller.displayName })}</p>
            <Link to={paths.product(product.id)} className="mt-2 outline-none">
              <Button size="lg" variant="accent" className="shadow-lift">
                {t('hero.buyNow')}
                <Icon variant="icon-arrow-right" size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      aria-label={side === 'left' ? t('hero.prevSlide') : t('hero.nextSlide')}
      className={cn(
        // Hidden on mobile (arrows would overlap the price/CTA on a narrow
        // slide); dots handle navigation there.
        'absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-white outline-none backdrop-blur-sm transition-colors hover:bg-white/40 focus-visible:ring-2 focus-visible:ring-white sm:flex',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <span className={side === 'right' ? 'rotate-180' : ''}>
        <Icon variant="icon-arrow-left" size={18} />
      </span>
    </button>
  );
}
