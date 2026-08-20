import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { paths } from '@/routes/paths';
import { Icon, type IconVariant } from '@/components/icon';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Avatar } from '@/components/avatar';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useCart } from '@/features/cart/cart-context';
import { HeaderSearch } from './header-search';
import { HeaderTopBar } from './header-top-bar';
import { CategoryMegaMenu } from './category-mega-menu';
import { MobileNav } from './mobile-nav';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { CartMini } from '@/features/cart/components/cart-mini';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

/** Sticky glass navigation: promo top-bar, brand, mega-menu, search, actions. */
export function SiteHeader() {
  const { t } = useTranslation();
  const { isAuthenticated, user, logout } = useAuth();
  const { totalItems, open } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Shadow when scrolled + hide-on-scroll-down / show-on-scroll-up. A small
  // threshold avoids flicker on trackpad jitter; the header always shows near
  // the top of the page.
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (Math.abs(y - lastY) > 6) {
        setHidden(y > lastY && y > 120);
        lastY = y;
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-transform duration-300 ease-out',
        hidden && '-translate-y-full',
      )}
    >
      <HeaderTopBar />
      <div className={cn('glass border-b border-border transition-shadow', scrolled && 'shadow-card')}>
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:gap-4">
          <Link to={paths.home} className="shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg">
            <BrandLogo />
          </Link>

          <div className="hidden lg:block">
            <CategoryMegaMenu />
          </div>

          <div className="hidden flex-1 md:block">
            <HeaderSearch />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1">
          {isAuthenticated && (
            <Link
              to={paths.messages}
              className="hidden h-10 w-10 items-center justify-center rounded-md text-text transition-colors hover:bg-surface-2 md:flex"
              aria-label={t('header.messages')}
              title={t('header.messages')}
            >
              <Icon variant="icon-mail" size={20} />
            </Link>
          )}

          {isAuthenticated && <NotificationBell />}

          {/* Desktop: hover-preview mini-cart (click opens the full drawer). */}
          <CartMini />

          {isAuthenticated && (
            <Link
              to={paths.messages}
              className="relative flex h-10 w-10 items-center justify-center rounded-md text-text transition-colors hover:bg-surface-2 md:hidden"
              aria-label={t('header.messages')}
              title={t('header.messages')}
            >
              <Icon variant="icon-mail" size={20} />
            </Link>
          )}

          {/* Mobile: plain cart button → opens drawer / triggers the FAB popover. */}
          <button
            onClick={open}
            className="relative flex h-10 w-10 items-center justify-center rounded-md text-text transition-colors hover:bg-surface-2 md:hidden"
            aria-label={t('header.cart')}
          >
            <Icon variant="icon-cart" size={20} />
            {totalItems > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-on-accent">
                {totalItems}
              </span>
            )}
          </button>

          {/* Language + theme live in the mobile menu to keep the bar uncluttered. */}
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          <div className="hidden md:block">
            <ThemeToggle />
          </div>

          {/* Hamburger — mobile only. */}
          <button
            onClick={() => setMobileNav(true)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-text hover:bg-surface-2 md:hidden"
            aria-label={t('header.menu')}
          >
            <Icon variant="icon-menu" size={22} />
          </button>

          {isAuthenticated ? (
            <div className="relative hidden md:block">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-md p-1 hover:bg-surface-2"
                aria-label={t('header.account')}
              >
                <Avatar src={user?.avatarUrl} name={user?.fullName} size={32} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-[min(13rem,calc(100vw-1rem))] rounded-lg border border-border bg-surface p-1.5 shadow-lg">
                    <div className="border-b border-border px-3 py-2">
                      <p className="truncate text-sm font-semibold text-text">{user?.fullName}</p>
                      <p className="truncate text-xs text-muted">{user?.email}</p>
                    </div>
                    <MenuLink to={paths.account.profile} icon="icon-user" onClick={() => setMenuOpen(false)}>
                      {t('header.profile')}
                    </MenuLink>
                    <MenuLink to={paths.account.addresses} icon="icon-map-pin" onClick={() => setMenuOpen(false)}>
                      {t('header.addresses')}
                    </MenuLink>
                    <MenuLink to={paths.messages} icon="icon-mail" onClick={() => setMenuOpen(false)}>
                      {t('header.messages')}
                    </MenuLink>
                    <MenuLink to={paths.account.notifications} icon="icon-bell" onClick={() => setMenuOpen(false)}>
                      {t('header.notifications')}
                    </MenuLink>
                    {user?.role === 'SHIPPER' && (
                      <MenuLink to={paths.shipper.shipments} icon="icon-truck" onClick={() => setMenuOpen(false)}>
                        {t('header.shipperDashboard', { defaultValue: 'Shipper Dashboard' })}
                      </MenuLink>
                    )}
                    <button
                      onClick={() => {
                        logout.mutate();
                        setMenuOpen(false);
                        navigate(paths.home);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-danger hover:bg-surface-2"
                    >
                      <Icon variant="icon-logout" size={18} />
                      {t('header.logout')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              to={paths.login}
              className="ml-1 hidden h-10 shrink-0 items-center whitespace-nowrap rounded-md bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover md:flex"
            >
              {t('header.login')}
            </Link>
          )}
          </div>
        </div>

        {/* Mobile slide-out menu */}
        <MobileNav
          open={mobileNav}
          onClose={() => setMobileNav(false)}
          isAuthenticated={isAuthenticated}
          user={user}
          onLogout={() => {
            logout.mutate();
            setMobileNav(false);
            navigate(paths.home);
          }}
        />

        {/* Secondary nav row: quick links (desktop) */}
        <div className="hidden border-t border-border/60 lg:block">
          <nav className="mx-auto flex h-11 max-w-[1280px] items-center gap-1 px-4 text-sm">
            {QUICK_LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted hover:text-text',
                  )
                }
              >
                {t(l.labelKey)}
              </NavLink>
            ))}
            <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Icon variant="icon-sparkles" size={14} />
              {t('header.dailyDeals')}
            </span>
          </nav>
        </div>

        {/* Mobile search */}
        <div className="border-t border-border px-4 py-2 md:hidden">
          <HeaderSearch />
        </div>
      </div>
    </header>
  );
}

const QUICK_LINKS: { to: string; labelKey: string; end?: boolean }[] = [
  { to: paths.home, labelKey: 'header.navHome', end: true },
  { to: paths.products, labelKey: 'header.navAllProducts' },
  { to: `${paths.products}?sort=rating_desc`, labelKey: 'header.navTopRated' },
  { to: `${paths.products}?sort=newest`, labelKey: 'header.navNewest' },
];

function MenuLink({
  to,
  icon,
  children,
  onClick,
}: {
  to: string;
  icon: IconVariant;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn('flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-text hover:bg-surface-2')}
    >
      <Icon variant={icon} size={18} />
      {children}
    </Link>
  );
}
