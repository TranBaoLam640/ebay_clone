import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category, ProductFormat } from '../types/catalog.types';
import { Button } from '@/components/button';
import { cn } from '@/utils/cn';

export interface FilterState {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  rating?: number;
  format?: ProductFormat;
}

interface FilterSidebarProps {
  categories: Category[];
  value: FilterState;
  onChange: (next: FilterState) => void;
}

/** Faceted filter panel: category, price range, availability, min rating. */
export function FilterSidebar({ categories, value, onChange }: FilterSidebarProps) {
  const { t } = useTranslation();
  // Prices are shown in VND (÷100 from stored cents on submit).
  const [minVnd, setMinVnd] = useState(value.minPrice ? String(value.minPrice / 100) : '');
  const [maxVnd, setMaxVnd] = useState(value.maxPrice ? String(value.maxPrice / 100) : '');

  const applyPrice = () => {
    onChange({
      ...value,
      minPrice: minVnd ? Number(minVnd) * 100 : undefined,
      maxPrice: maxVnd ? Number(maxVnd) * 100 : undefined,
    });
  };

  const reset = () => {
    setMinVnd('');
    setMaxVnd('');
    onChange({});
  };

  return (
    <div className="flex flex-col gap-6">
      <FilterGroup title={t('filters.category')}>
        <button
          onClick={() => onChange({ ...value, categoryId: undefined })}
          className={cn('block w-full rounded px-2 py-1.5 text-left text-sm', !value.categoryId ? 'bg-primary/10 font-semibold text-primary' : 'text-text hover:bg-surface-2')}
        >
          {t('filters.all')}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => onChange({ ...value, categoryId: c.id })}
            className={cn('block w-full rounded px-2 py-1.5 text-left text-sm', value.categoryId === c.id ? 'bg-primary/10 font-semibold text-primary' : 'text-text hover:bg-surface-2')}
          >
            {c.name}
          </button>
        ))}
      </FilterGroup>

      <FilterGroup title={t('filters.format')}>
        {([undefined, 'auction', 'offerable'] as const).map((f) => {
          const label =
            f === 'auction'
              ? t('filters.auctions')
              : f === 'offerable'
                ? t('filters.acceptsOffers')
                : t('filters.all');
          const active = value.format === f;
          return (
            <button
              key={f ?? 'all'}
              onClick={() => onChange({ ...value, format: f })}
              className={cn('block w-full rounded px-2 py-1.5 text-left text-sm', active ? 'bg-primary/10 font-semibold text-primary' : 'text-text hover:bg-surface-2')}
            >
              {label}
            </button>
          );
        })}
      </FilterGroup>

      <FilterGroup title={t('filters.priceRange')}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder={t('filters.from')}
            value={minVnd}
            onChange={(e) => setMinVnd(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-text"
          />
          <span className="text-muted">—</span>
          <input
            type="number"
            min={0}
            placeholder={t('filters.to')}
            value={maxVnd}
            onChange={(e) => setMaxVnd(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-text"
          />
        </div>
        <Button size="sm" variant="secondary" fullWidth onClick={applyPrice} className="mt-2">
          {t('filters.applyPrice')}
        </Button>
      </FilterGroup>

      <FilterGroup title={t('filters.availability')}>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={!!value.inStock}
            onChange={(e) => onChange({ ...value, inStock: e.target.checked || undefined })}
            className="h-4 w-4 accent-[var(--c-primary)]"
          />
          {t('filters.inStockOnly')}
        </label>
      </FilterGroup>

      <FilterGroup title={t('filters.minRating')}>
        <div className="flex flex-wrap gap-1.5">
          {[5, 4, 3].map((r) => (
            <button
              key={r}
              onClick={() => onChange({ ...value, rating: value.rating === r ? undefined : r })}
              className={cn('rounded-md border px-2.5 py-1 text-sm', value.rating === r ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text hover:bg-surface-2')}
            >
              {t('filters.ratingUp', { count: r })}
            </button>
          ))}
        </div>
      </FilterGroup>

      <Button variant="ghost" size="sm" onClick={reset}>
        {t('filters.clear')}
      </Button>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}
