import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { paths } from '@/routes/paths';
import { Icon, type IconVariant } from '@/components/icon';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';

/** Split-screen shell for auth pages: rich brand panel + centered form card. */
export function AuthLayout() {
  const { t } = useTranslation();

  // Trust points shown on the brand panel — the same promises as the storefront.
  const HIGHLIGHTS: { icon: IconVariant; label: string }[] = [
    { icon: 'icon-shield', label: t('auth.highlight.authentic') },
    { icon: 'icon-star-fill', label: t('auth.highlight.reviews') },
    { icon: 'icon-lock', label: t('auth.highlight.secure') },
  ];

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Brand panel (hidden on small screens) */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-[color:var(--grad-c)] p-12 text-white lg:flex">
        {/* Soft decorative glows — depth without heavy imagery. */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        {/* Subtle dotted texture. */}
        <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-[0.15]" />

        <div className="relative">
          <Link to={paths.home} className="inline-flex outline-none">
            <BrandLogo size="lg" className="text-white [&_.text-accent]:text-accent" />
          </Link>
        </div>

        <div className="relative">
          <h1 className="max-w-md text-4xl font-extrabold leading-[1.15] tracking-tight">
            {t('auth.brandHeadline')}
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            {t('auth.brandBody')}
          </p>
          <ul className="mt-8 flex flex-col gap-4">
            {HIGHLIGHTS.map((h) => (
              <li key={h.label} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <Icon variant={h.icon} size={18} />
                </span>
                {h.label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/60">© {new Date().getFullYear()} SBay</p>
      </aside>

      {/* Form area */}
      <div className="flex w-full flex-col lg:w-1/2">
        <div className="flex items-center justify-between p-4">
          <Link to={paths.home} className="outline-none lg:hidden">
            <BrandLogo size="sm" />
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-8">
          {/* Elevated card so the form reads as a distinct, trustworthy surface. */}
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-card">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
