import { useTranslation } from 'react-i18next';
import type { ProductListItem } from '../types/catalog.types';
import { ProductCard } from './product-card';
import { Skeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { useGsapReveal } from '@/hooks/use-gsap-reveal';

interface ProductGridProps {
  products: ProductListItem[];
  loading?: boolean;
  skeletonCount?: number;
}

/** Responsive product grid with staggered scroll-reveal and loading skeletons. */
export function ProductGrid({ products, loading, skeletonCount = 10 }: ProductGridProps) {
  const { t } = useTranslation();
  const gridRef = useGsapReveal<HTMLDivElement>({ deps: [products] });

  // Explicit column counts so wide screens cap at 5 (6 felt cramped):
  // 2 (mobile) → 3 (sm) → 4 (lg) → 5 (xl).
  const grid = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

  if (loading) {
    return (
      <div className={grid}>
        {Array.from({ length: skeletonCount }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon="icon-search"
        title={t('catalog.emptyTitle')}
        description={t('catalog.emptyDescription')}
      />
    );
  }

  return (
    <div ref={gridRef} className={grid}>
      {products.map((p) => (
        <div key={p.id}>
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}
