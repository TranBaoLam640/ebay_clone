import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCategories } from '../hooks/use-catalog';
import { SectionHeader } from '@/components/section-header';
import { Section } from '@/components/section';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { useGsapReveal } from '@/hooks/use-gsap-reveal';
import { categoryIcon } from '../utils/category-icon';
import { paths } from '@/routes/paths';

/** Grid of category entry tiles with scroll-reveal stagger. */
export function CategoryShowcase() {
  const { t } = useTranslation();
  const { data: categories, isLoading } = useCategories();
  const ref = useGsapReveal<HTMLDivElement>({ selector: '.cat-tile', deps: [categories] });

  return (
    <Section>
      <div className="col-span-12">
        <SectionHeader
          eyebrow={t('categoryShowcase.eyebrow')}
          title={t('categoryShowcase.title')}
          description={t('categoryShowcase.description')}
        />
      </div>
      {/* Auto-fit grid: tiles keep a comfortable min width and share the row
          evenly, so a short category list fills the width instead of leaving a
          stranded gap (backend may seed only a few categories). */}
      <div
        ref={ref}
        className="col-span-12 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]"
      >
        {isLoading
          ? Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))
          : (categories ?? []).map((c) => (
              <Link
                key={c.id}
                to={`${paths.products}?categoryId=${c.id}`}
                className="cat-tile reveal-init group flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-5 text-center outline-none transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-card focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                  <Icon variant={categoryIcon(c.name)} size={24} />
                </span>
                <span className="text-sm font-semibold text-text">{c.name}</span>
              </Link>
            ))}
      </div>
    </Section>
  );
}
