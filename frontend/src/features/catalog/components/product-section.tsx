import { useProducts } from '../hooks/use-catalog';
import { ProductGrid } from './product-grid';
import { SectionHeader } from '@/components/section-header';
import { Section } from '@/components/section';
import type { ProductQuery } from '../types/catalog.types';

interface ProductSectionProps {
  eyebrow?: string;
  title: string;
  description?: string;
  query: ProductQuery;
  linkTo?: string;
  tinted?: boolean;
}

/** Homepage product block: heading + a grid driven by a catalog query. */
export function ProductSection({
  eyebrow,
  title,
  description,
  query,
  linkTo,
  tinted = false,
}: ProductSectionProps) {
  const { data, isLoading } = useProducts({ limit: 10, ...query });

  return (
    // Product grids grow with their content — no forced min-h so a short result
    // set (e.g. few seeded products) doesn't leave a big empty gap.
    <Section tinted={tinted}>
      <div className="col-span-12">
        <SectionHeader eyebrow={eyebrow} title={title} description={description} linkTo={linkTo} />
      </div>
      <div className="col-span-12">
        <ProductGrid products={data?.items ?? []} loading={isLoading} />
      </div>
    </Section>
  );
}
