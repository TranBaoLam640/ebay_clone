import { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { User } from '@/features/auth/types/auth.types';
import { paths } from '@/routes/paths';
import { Icon, type IconVariant } from '@/components/icon';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { lockScroll, unlockScroll } from '@/hooks/scroll-lock';
import { cn } from '@/utils/cn';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  user: User | null;
  onLogout: () => void;
}

const NAV: { to: string; labelKey: string; icon: IconVariant; end?: boolean }[] = [
  { to: paths.home, labelKey: 'header.navHome', icon: 'icon-home', end: true },
  { to: paths.products, labelKey: 'header.navAllProducts', icon: 'icon-grid' },
  { to: `${paths.products}?sort=rating_desc`, labelKey: 'header.navTopRated', icon: 'icon-star' },
  { to: `${paths.products}?sort=newest`, labelKey: 'header.navNewest', icon: 'icon-sparkles' },
];

const ACCOUNT: { to: string; labelKey: string; icon: IconVariant }[] = [
  { to: paths.account.profile, labelKey: 'header.profile', icon: 'icon-user' },
  { to: paths.orders, labelKey: 'account.navOrders', icon: 'icon-package' },
  { to: paths.messages, labelKey: 'header.messages', icon: 'icon-mail' },
  { to: paths.account.addresses, labelKey: 'header.addresses', icon: 'icon-map-pin' },
  { to: paths.account.notifications, labelKey: 'header.notifications', icon: 'icon-bell' },
];

/** Full-height slide-in menu for phones: brand nav, account, language + theme. */
export function MobileNav({ open, onClose, isAuthenticated, user, onLogout }: MobileNavProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    lockScroll(); // pause Lenis + pin the page behind the menu
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockScroll();
    };
  }, [open, onClose]);

  if (!open) return null;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
      isActive ? 'bg-accent text-on-accent' : 'text-text hover:bg-surface-2',
    );

  return createPortal(
    <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-[82%] max-w-sm flex-col bg-surface shadow-xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <BrandLogo size="sm" />
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
            aria-label="Close"
          >
            <Icon variant="icon-close" size={20} />
          </button>
        </header>

        {isAuthenticated && (
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Avatar src={user?.avatarUrl} name={user?.fullName} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{user?.fullName}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-3">
          <MobileNavList items={NAV} onNavigate={onClose} linkClass={linkClass} />

          {isAuthenticated && (
            <>
              <Divider />
              <MobileNavList
                items={[
                  ...ACCOUNT,
                  ...(user?.role === 'SHIPPER'
                    ? [
                        {
                          to: paths.shipper.shipments,
                          labelKey: 'header.shipperDashboard',
                          fallback: 'Shipper Dashboard',
                          icon: 'icon-truck' as const,
                        },
                      ]
                    : []),
                ]}
                onNavigate={onClose}
                linkClass={linkClass}
              />
            </>
          )}
        </nav>

        {/* Language + theme + auth action */}
        <div className="flex flex-col gap-3 border-t border-border p-4">
          <div className="flex items-center justify-between">
            <LanguageSwitcher drop="up" align="left" />
            <ThemeToggle />
          </div>
          {isAuthenticated ? (
            <Button variant="secondary" fullWidth onClick={onLogout}>
              <Icon variant="icon-logout" size={18} />
              <MobileLabel keyName="header.logout" />
            </Button>
          ) : (
            <Link to={paths.login} onClick={onClose}>
              <Button variant="accent" fullWidth>
                <MobileLabel keyName="header.login" />
              </Button>
            </Link>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function MobileNavList({
  items,
  onNavigate,
  linkClass,
}: {
  items: { to: string; labelKey: string; fallback?: string; icon: IconVariant; end?: boolean }[];
  onNavigate: () => void;
  linkClass: (s: { isActive: boolean }) => string;
}) {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.labelKey}>
          <NavLink to={item.to} end={item.end} onClick={onNavigate} className={linkClass}>
            <Icon variant={item.icon} size={18} />
            {t(item.labelKey, { defaultValue: item.fallback })}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function MobileLabel({ keyName }: { keyName: string }) {
  const { t } = useTranslation();
  return <>{t(keyName)}</>;
}

function Divider() {
  return <div className="my-3 border-t border-border" />;
}
