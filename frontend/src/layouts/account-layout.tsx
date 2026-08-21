import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { paths } from '@/routes/paths';
import { Icon, type IconVariant } from '@/components/icon';
import { Select } from '@/components/select';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { cn } from '@/utils/cn';

/** Account section shell: dropdown nav on mobile, sticky sidebar on desktop. */
export function AccountLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const NAV: { to: string; label: string; icon: IconVariant; end?: boolean }[] = [
    { to: paths.account.profile, label: t('account.navProfile'), icon: 'icon-user' },
    { to: paths.orders, label: t('account.navOrders'), icon: 'icon-package' },
    { to: paths.messages, label: t('account.navMessages'), icon: 'icon-mail' },
    { to: paths.account.bids, label: t('account.navBids'), icon: 'icon-tag' },
    { to: paths.account.offers, label: t('account.navOffers'), icon: 'icon-gift' },
    ...(user?.sellerProfile
      ? [
          {
            to: paths.account.sellerShipments,
            label: t('account.navSellerShipments', { defaultValue: 'Seller Shipments' }),
            icon: 'icon-truck' as const,
          },
          {
            to: paths.account.requestsDisputes,
            label: 'Requests & Disputes',
            icon: 'icon-headset' as const,
          },
          { to: paths.account.sellerFeedbacks, label: t('account.navSellerFeedbacks'), icon: 'icon-star' as const },
        ]
      : []),
    { to: paths.account.password, label: t('account.navPassword'), icon: 'icon-shield' },
    { to: paths.account.addresses, label: t('account.navAddresses'), icon: 'icon-map-pin' },
    { to: paths.account.notifications, label: t('account.navNotifications'), icon: 'icon-bell' },
  ];

  const location = useLocation();
  const navigate = useNavigate();
  const current = NAV.find((n) => location.pathname.startsWith(n.to))?.to ?? NAV[0].to;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t('account.pageTitle')}</h1>
      <div className="grid min-w-0 gap-8 lg:grid-cols-[240px_1fr]">
        {/* Stick below the full desktop header (top-bar 36 + main 64 + nav 44 = 144px)
            plus a little breathing room, so it never overlaps the header on scroll-up. */}
        <aside className="min-w-0 lg:sticky lg:top-[152px] lg:self-start">
          {/* Mobile: a themed dropdown (no ugly horizontal scroll). */}
          <div className="lg:hidden">
            <Select
              aria-label={t('account.mobileNavAriaLabel')}
              value={current}
              onValueChange={(v) => navigate(v)}
              options={NAV.map((n) => ({ value: n.to, label: n.label }))}
            />
          </div>

          {/* Desktop: vertical list. */}
          <nav className="hidden lg:flex lg:flex-col lg:gap-1 lg:rounded-xl lg:border lg:border-border lg:bg-surface lg:p-2">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40',
                    isActive ? 'bg-accent text-on-accent' : 'text-text hover:bg-surface-2',
                  )
                }
              >
                <Icon variant={item.icon} size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        {/* Reserve height so the footer stays put while the panel data loads. */}
        <section className="min-h-[60vh] min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
