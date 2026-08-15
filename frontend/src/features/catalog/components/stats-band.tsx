import { useTranslation } from 'react-i18next';
import { useCountUp } from '@/hooks/use-count-up';
import { useCategories, useProducts } from '../hooks/use-catalog';

/** Count-up statistics band; each number animates when the section mounts. */
export function StatsBand() {
  const { t } = useTranslation();
  // Real figures from the catalog API. The last two are service commitments
  // (not measurable metrics), so they stay fixed.
  const { data: products } = useProducts({ limit: 1 });
  const { data: categories } = useCategories();

  const stats = [
    { to: products?.meta?.totalItems ?? 0, suffix: '+', label: t('home.statProducts') },
    { to: categories?.length ?? 0, suffix: '+', label: t('home.statCategories') },
    { to: 100, suffix: '%', label: t('home.statRealReviews') },
    { to: 24, suffix: '/7', label: t('home.statSupport') },
  ];

  return (
    <section className="bg-primary text-on-primary">
      {/* 2 columns on mobile, 4 from md. Tighter gap on mobile so the numbers
          never overflow the viewport. */}
      <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-x-4 gap-y-8 px-4 py-12 md:grid-cols-4 md:gap-8">
        {stats.map((s) => (
          <StatItem key={s.label} {...s} />
        ))}
      </div>
    </section>
  );
}

function StatItem({ to, suffix, label }: { to: number; suffix: string; label: string }) {
  // Re-run the count-up when the real value arrives from the API.
  const ref = useCountUp(to, { suffix });
  return (
    <div className="text-center">
      <p className="text-4xl font-extrabold md:text-5xl">
        <span ref={ref}>0{suffix}</span>
      </p>
      <p className="mt-1 text-sm text-on-primary/80">{label}</p>
    </div>
  );
}
