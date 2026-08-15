import { useTranslation } from 'react-i18next';
import type { ProductAttribute } from '@/features/catalog/types/catalog.types';

/** Renders typed dynamic attributes as a spec table (name → value + unit). */
export function AttributeTable({ attributes }: { attributes: ProductAttribute[] }) {
  const { t } = useTranslation();

  if (attributes.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-text">{t('productDetail.specs')}</h2>
      <dl className="overflow-hidden rounded-lg border border-border">
        {attributes.map((attr, i) => (
          <div
            key={attr.normalizedName + i}
            className={`grid grid-cols-[40%_1fr] ${i % 2 === 0 ? 'bg-surface' : 'bg-surface-2'}`}
          >
            <dt className="px-4 py-2.5 text-sm text-muted">{attr.name}</dt>
            <dd className="px-4 py-2.5 text-sm font-medium text-text">
              {formatBooleanValue(attr, t)}
              {attr.unit ? ` ${attr.unit}` : ''}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function formatBooleanValue(attr: ProductAttribute, t: (key: string) => string): string {
  if (attr.dataType === 'boolean') return attr.value ? t('productDetail.boolYes') : t('productDetail.boolNo');
  return String(attr.value);
}
