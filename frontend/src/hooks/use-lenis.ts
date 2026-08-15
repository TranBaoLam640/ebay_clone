import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useDeviceTier } from './use-device-tier';
import { setLenisInstance } from './scroll-lock';

gsap.registerPlugin(ScrollTrigger);

/**
 * Initializes Lenis smooth scroll for the whole app and syncs it with GSAP
 * ScrollTrigger so scroll-based animations stay accurate.
 *
 * On low-tier devices (weak CPU/GPU or reduced-motion) we skip Lenis entirely
 * and use native scrolling — the extra rAF loop + transform-driven scroll is a
 * common cause of jank on 2-core machines. ScrollTrigger still works with
 * native scroll.
 */
export function useLenis() {
  const tier = useDeviceTier();

  useEffect(() => {
    if (tier === 'low') return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on('scroll', ScrollTrigger.update);
    // Expose the instance so overlays can pause/resume smooth scroll.
    setLenisInstance(lenis);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      setLenisInstance(null);
      lenis.destroy();
    };
  }, [tier]);
}
