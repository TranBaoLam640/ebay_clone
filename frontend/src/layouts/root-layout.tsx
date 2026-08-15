import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLenis } from '@/hooks/use-lenis';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';
import { CartDrawer } from '@/features/cart/components/cart-drawer';
import { CartFab } from '@/features/cart/components/cart-fab';

/** App shell for public + account routes: header, page outlet, footer, cart. */
export function RootLayout() {
  const location = useLocation();
  useLenis();

  // Recalculate scroll-trigger positions after route/content changes and once
  // fonts/images settle, so scrubbed animations line up with the new layout.
  useEffect(() => {
    window.scrollTo(0, 0);
    const timers = [100, 500, 1200].map((ms) => setTimeout(() => ScrollTrigger.refresh(), ms));
    return () => timers.forEach(clearTimeout);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <SiteHeader />
      {/* Reserve most of the viewport so the footer starts below the fold and
          doesn't jump down when async page content finishes loading (CLS). */}
      <main className="flex-1 min-h-[80vh]">
        <Outlet />
      </main>
      <SiteFooter />
      <CartDrawer />
      <CartFab />
    </div>
  );
}
