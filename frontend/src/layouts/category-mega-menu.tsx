import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCategories } from '@/features/catalog/hooks/use-catalog';
import { paths } from '@/routes/paths';
import { Icon } from '@/components/icon';

/**
 * "All categories" trigger with a hover/click dropdown panel listing top-level
 * categories. Kept lightweight — full mega-menu columns would need a subcategory
 * API the backend doesn't expose yet.
 */
export function CategoryMegaMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: categories } = useCategories();

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-md bg-primary-soft px-3.5 text-sm font-semibold text-primary transition-colors hover:brightness-95"
        aria-expanded={open}
      >
        <Icon variant="icon-grid" size={18} />
        {t('megaMenu.categories')}
        <Icon variant="icon-chevron-down" size={16} />
      </button>

      {open && (categories?.length ?? 0) > 0 && (
        <div className="absolute left-0 top-full z-40 w-64 pt-2">
          <div className="overflow-hidden rounded-xl border border-border bg-surface p-2 shadow-lift">
            {categories!.map((c) => (
              <Link
                key={c.id}
                to={`${paths.products}?categoryId=${c.id}`}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-text transition-colors hover:bg-primary-soft hover:text-primary"
              >
                <span className="flex items-center gap-2.5">
                  <Icon variant="icon-tag" size={16} />
                  {c.name}
                </span>
                <Icon variant="icon-chevron-right" size={14} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
