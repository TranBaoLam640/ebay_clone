import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProducts, useCategories } from '../hooks/use-catalog';
import { ProductGrid } from '../components/product-grid';
import { FilterSidebar, type FilterState } from '../components/filter-sidebar';
import { Pagination } from '@/components/pagination';
import { Select } from '@/components/select';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import type { ProductSort } from '../types/catalog.types';

/** Catalog browse page. Filters/sort/search sync with URL query params. */
export default function ProductListPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const SORT_OPTIONS = [
    { value: 'newest', label: t('productList.sortNewest') },
    { value: 'price_asc', label: t('productList.sortPriceAsc') },
    { value: 'price_desc', label: t('productList.sortPriceDesc') },
    { value: 'rating_desc', label: t('productList.sortRating') },
  ];
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const search = searchParams.get('search') ?? undefined;
  const sort = (searchParams.get('sort') as ProductSort) ?? 'newest';

  const filters: FilterState = useMemo(
    () => ({
      categoryId: searchParams.get('categoryId') ?? undefined,
      minPrice: numParam(searchParams.get('minPrice')),
      maxPrice: numParam(searchParams.get('maxPrice')),
      inStock: searchParams.get('inStock') === 'true' || undefined,
      rating: numParam(searchParams.get('rating')),
      format: (searchParams.get('format') as FilterState['format']) ?? undefined,
    }),
    [searchParams],
  );

  const { data: categories } = useCategories();
  const { data, isLoading, isFetching } = useProducts({
    page,
    limit: 20,
    search,
    sort,
    ...filters,
  });

  const patchParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    });
    setSearchParams(next);
    setPage(1);
  };

  const applyFilters = (f: FilterState) => {
    patchParams({
      categoryId: f.categoryId,
      minPrice: f.minPrice ? String(f.minPrice) : undefined,
      maxPrice: f.maxPrice ? String(f.maxPrice) : undefined,
      inStock: f.inStock ? 'true' : undefined,
      rating: f.rating ? String(f.rating) : undefined,
      format: f.format,
    });
  };

  const meta = data?.meta;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-text">
            {search ? t('productList.resultsFor', { query: search }) : t('productList.allProducts')}
          </h1>
          {meta && <p className="text-sm text-muted">{t('productList.itemCount', { count: meta.totalItems })}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="lg:hidden"
            onClick={() => setShowFilters((s) => !s)}
          >
            <Icon variant="icon-filter" size={16} />
            {t('productList.filter')}
          </Button>
          <div className="w-48">
            <Select
              options={SORT_OPTIONS}
              value={sort}
              onValueChange={(v) => patchParams({ sort: v })}
              aria-label={t('productList.sortLabel')}
            />
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-8 lg:grid-cols-[240px_1fr]">
        <aside className={`${showFilters ? 'block' : 'hidden'} min-w-0 lg:block lg:sticky lg:top-24 lg:self-start`}>
          <FilterSidebar categories={categories ?? []} value={filters} onChange={applyFilters} />
        </aside>

        {/* Reserve vertical space so the footer doesn't jump up while the grid
            loads/refetches (a major CLS source). */}
        <div className="min-h-[70vh]">
          <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}>
            <ProductGrid products={data?.items ?? []} loading={isLoading} />
          </div>
          {meta && (
            <div className="mt-8">
              <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function numParam(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
