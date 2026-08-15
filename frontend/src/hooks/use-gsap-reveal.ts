import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { useDeviceTier } from './use-device-tier';

gsap.registerPlugin(useGSAP);

interface RevealOptions {
  /** CSS selector (scoped to the container) for elements to reveal. */
  selector?: string;
  /** Stagger between items, seconds. */
  stagger?: number;
  /** Vertical offset to animate from, px. */
  y?: number;
  /** Extra dependencies — re-run reveal when these change (e.g. loaded data). */
  deps?: unknown[];
}

/**
 * On-mount reveal (fade + rise + stagger) for a group of elements. Returns a ref
 * to attach to the container.
 *
 * These blocks are wrapped in <LazyMount>, which only mounts them once they are
 * about to scroll into view. So "mounted" already means "near the viewport" —
 * animating on mount is both correct and immediate, with none of the lag that a
 * separate scroll trigger adds (mount → fetch → ScrollTrigger recalculation)
 * when smooth scroll moves the page quickly. No-op under reduced motion — the
 * `.reveal-init` CSS rule keeps elements visible in that case.
 *
 * Usage:
 *   const ref = useGsapReveal({ selector: '.reveal-init' });
 *   <section ref={ref}> ...cards with className="reveal-init"... </section>
 */
export function useGsapReveal<T extends HTMLElement = HTMLDivElement>({
  selector = '.reveal-init',
  stagger = 0.05,
  y = 16,
  deps = [],
}: RevealOptions = {}) {
  const containerRef = useRef<T>(null);
  const tier = useDeviceTier();

  useGSAP(
    () => {
      const targets = containerRef.current?.querySelectorAll(selector);
      if (!targets || targets.length === 0) return;

      // Low-tier / reduced-motion: reveal instantly. `.reveal-init` starts
      // hidden, so we must make it visible here.
      if (tier === 'low') {
        gsap.set(targets, { opacity: 1, y: 0, clearProps: 'transform' });
        return;
      }

      gsap.fromTo(
        targets,
        { opacity: 0, y },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger },
      );
    },
    { scope: containerRef, dependencies: [...deps, tier] },
  );

  return containerRef;
}
