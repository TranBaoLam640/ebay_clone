import { useTranslation } from 'react-i18next';
import { SectionHeader } from '@/components/section-header';
import { Section } from '@/components/section';
import { Icon, type IconVariant } from '@/components/icon';
import { useGsapReveal } from '@/hooks/use-gsap-reveal';

const REASONS: { icon: IconVariant; titleKey: string; textKey: string }[] = [
  { icon: 'icon-shield', titleKey: 'whyUs.authenticTitle', textKey: 'whyUs.authenticText' },
  { icon: 'icon-star-fill', titleKey: 'whyUs.reviewsTitle', textKey: 'whyUs.reviewsText' },
  { icon: 'icon-truck', titleKey: 'whyUs.deliveryTitle', textKey: 'whyUs.deliveryText' },
  { icon: 'icon-lock', titleKey: 'whyUs.securityTitle', textKey: 'whyUs.securityText' },
];

/** "Why choose us" feature grid with scroll-reveal. */
export function WhyUs() {
  const { t } = useTranslation();
  const ref = useGsapReveal<HTMLDivElement>({ selector: '.why-item' });
  return (
    <Section>
      <div className="col-span-12">
        <SectionHeader
          eyebrow={t('whyUs.eyebrow')}
          title={t('whyUs.title')}
          description={t('whyUs.description')}
          align="center"
        />
      </div>
      {/* 12-col: each reason spans 12/6/3 → 1/2/4 per row. */}
      <div ref={ref} className="col-span-12 grid grid-cols-12 gap-5">
        {REASONS.map((r) => (
          <div
            key={r.titleKey}
            className="why-item reveal-init col-span-12 rounded-xl border border-border bg-surface p-6 transition-all hover:-translate-y-1 hover:shadow-card sm:col-span-6 lg:col-span-3"
          >
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon variant={r.icon} size={24} />
            </span>
            <h3 className="mb-1.5 font-bold text-text">{t(r.titleKey)}</h3>
            <p className="text-sm text-muted">{t(r.textKey)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
