import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { paths } from '@/routes/paths';
import { Icon, type IconVariant } from '@/components/icon';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/button';
import { useToast } from '@/contexts/toast-context';

/** Rich multi-column footer: newsletter, link columns, trust, social. */
export function SiteFooter() {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [email, setEmail] = useState('');

  const subscribe = (e: FormEvent) => {
    e.preventDefault();
    notify(t('footer.subscribeSuccess'), 'success');
    setEmail('');
  };

  return (
    <footer className="mt-10 bg-surface">
      {/* Newsletter band */}
      <div className="border-y border-border bg-primary-soft">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-6 px-4 py-10 md:flex-row md:justify-between">
          <div className="max-w-md text-center md:text-left">
            <h3 className="text-xl font-extrabold text-text">{t('footer.newsletterTitle')}</h3>
            <p className="mt-1 text-sm text-muted">{t('footer.newsletterText')}</p>
          </div>
          <form onSubmit={subscribe} className="flex w-full max-w-md gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <Icon variant="icon-mail" size={18} />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('footer.emailPlaceholder')}
                className="h-11 w-full rounded-md border border-border bg-surface pl-10 pr-3 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
            <Button type="submit">{t('footer.subscribe')}</Button>
          </form>
        </div>
      </div>

      {/* Link columns */}
      <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2">
          <div className="mb-3">
            <BrandLogo />
          </div>
          <p className="max-w-xs text-sm text-muted">{t('footer.tagline')}</p>
          <div className="mt-4 flex gap-2">
            {(['icon-mail', 'icon-phone', 'icon-headset'] as IconVariant[]).map((ic) => (
              <span
                key={ic}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-primary hover:text-primary"
              >
                <Icon variant={ic} size={16} />
              </span>
            ))}
          </div>
        </div>

        <FooterCol
          title={t('footer.colShop')}
          links={[
            { label: t('footer.linkAllProducts'), to: paths.products },
            { label: t('footer.linkNewProducts'), to: `${paths.products}?sort=newest` },
            { label: t('footer.linkTopRated'), to: `${paths.products}?sort=rating_desc` },
          ]}
        />
        <FooterCol
          title={t('footer.colAccount')}
          links={[
            { label: t('footer.linkLogin'), to: paths.login },
            { label: t('footer.linkRegister'), to: paths.register },
            { label: t('footer.linkMyAddresses'), to: paths.account.addresses },
          ]}
        />
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t('footer.colCommitment')}</h4>
          <ul className="space-y-2.5 text-sm text-muted">
            <li className="flex items-center gap-2"><Icon variant="icon-truck" size={16} /> {t('footer.commitFastDelivery')}</li>
            <li className="flex items-center gap-2"><Icon variant="icon-refresh" size={16} /> {t('footer.commitReturns')}</li>
            <li className="flex items-center gap-2"><Icon variant="icon-lock" size={16} /> {t('footer.commitSecurePayment')}</li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-muted sm:flex-row">
          <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>
          <div className="flex items-center gap-2">
            {['VISA', 'MASTERCARD', 'MOMO', 'VNPAY'].map((p) => (
              <span
                key={p}
                className="rounded border border-border bg-surface-2 px-2 py-1 text-[10px] font-bold tracking-wide text-muted"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
      <ul className="space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to} className="text-text transition-colors hover:text-primary">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
