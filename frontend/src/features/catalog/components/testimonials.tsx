import { useTranslation } from 'react-i18next';
import { SectionHeader } from '@/components/section-header';
import { Section } from '@/components/section';
import { Icon } from '@/components/icon';
import { Avatar } from '@/components/avatar';
import { Rating } from '@/components/rating';
import { useGsapReveal } from '@/hooks/use-gsap-reveal';

// Illustrative testimonials (no reviews-of-marketplace API); realistic content.
const REVIEWS = [
  { nameKey: 'testimonials.review1Name', roleKey: 'testimonials.review1Role', rating: 5, textKey: 'testimonials.review1Text' },
  { nameKey: 'testimonials.review2Name', roleKey: 'testimonials.review2Role', rating: 5, textKey: 'testimonials.review2Text' },
  { nameKey: 'testimonials.review3Name', roleKey: 'testimonials.review3Role', rating: 4, textKey: 'testimonials.review3Text' },
];

/** Customer testimonial cards with scroll-reveal stagger. */
export function Testimonials() {
  const { t } = useTranslation();
  const ref = useGsapReveal<HTMLDivElement>({ selector: '.tm-card' });
  return (
    <Section tinted>
      <div className="col-span-12">
        <SectionHeader
          eyebrow={t('testimonials.eyebrow')}
          title={t('testimonials.title')}
          align="center"
        />
      </div>
      {/* 12-col: each testimonial spans 12/4 → 1/3 per row. */}
      <div ref={ref} className="col-span-12 grid grid-cols-12 gap-5">
        {REVIEWS.map((r) => (
          <figure
            key={r.nameKey}
            className="tm-card reveal-init col-span-12 flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 md:col-span-4"
          >
            <span className="text-primary/30">
              <Icon variant="icon-quote" size={32} />
            </span>
            <blockquote className="flex-1 text-text">{t(r.textKey)}</blockquote>
            <Rating value={r.rating} size={15} />
            <figcaption className="flex items-center gap-3">
              <Avatar name={t(r.nameKey)} size={40} />
              <div>
                <p className="font-semibold text-text">{t(r.nameKey)}</p>
                <p className="text-xs text-muted">{t(r.roleKey)}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
