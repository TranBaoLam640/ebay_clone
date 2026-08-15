import { useTranslation } from 'react-i18next';
import { HeroSlider } from '../components/hero-slider';
import { CategoryShowcase } from '../components/category-showcase';
import { ProductSection } from '../components/product-section';
import { StatsBand } from '../components/stats-band';
import { WhyUs } from '../components/why-us';
import { Testimonials } from '../components/testimonials';
import { LazyMount } from '@/components/lazy-mount';
import { paths } from '@/routes/paths';

/**
 * Marketplace landing page. Storefront-style order: promo slider → browse
 * (categories) → newest → top-rated → proof (stats) → reasons → testimonials.
 * Above-the-fold blocks render eagerly; the rest lazy-mount for a fast first
 * paint on weak devices.
 */
export default function HomePage() {
  const { t } = useTranslation();
  return (
    <div>
      {/* Above the fold — render eagerly. */}
      <HeroSlider />

      {/* Below the fold — mount just before scrolling into view (perf on weak
          devices: fewer ScrollTriggers/DOM up front, faster first paint). */}
      <LazyMount minHeight={640}>
        <CategoryShowcase />
      </LazyMount>

      <LazyMount minHeight={720}>
        <ProductSection
          eyebrow={t('home.newestEyebrow')}
          title={t('home.newestTitle')}
          description={t('home.newestDescription')}
          query={{ sort: 'newest' }}
          linkTo={`${paths.products}?sort=newest`}
        />
      </LazyMount>

      <LazyMount minHeight={720}>
        <ProductSection
          eyebrow={t('home.topRatedEyebrow')}
          title={t('home.topRatedTitle')}
          description={t('home.topRatedDescription')}
          query={{ sort: 'rating_desc' }}
          linkTo={`${paths.products}?sort=rating_desc`}
          tinted
        />
      </LazyMount>

      <LazyMount minHeight={280}>
        <StatsBand />
      </LazyMount>

      <LazyMount minHeight={560}>
        <WhyUs />
      </LazyMount>

      <LazyMount minHeight={560}>
        <Testimonials />
      </LazyMount>
    </div>
  );
}
