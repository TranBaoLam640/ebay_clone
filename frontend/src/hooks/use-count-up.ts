import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/**
 * Animates a number from 0 → `to` on mount. The stats band is wrapped in
 * <LazyMount>, so it only mounts near the viewport — counting on mount runs at
 * the right time without the scroll-trigger lag that shows a stale "0" first.
 * Returns a ref for the display element; its textContent is updated each frame.
 * Under reduced motion the final value is set immediately.
 */
export function useCountUp(to: number, { duration = 1.6, suffix = '', decimals = 0 } = {}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const format = (v: number) =>
        `${v.toLocaleString('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        el.textContent = format(to);
        return;
      }

      const obj = { val: 0 };
      gsap.to(obj, {
        val: to,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = format(obj.val);
        },
      });
    },
    { scope: ref, dependencies: [to] },
  );

  return ref;
}
