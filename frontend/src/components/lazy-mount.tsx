import { useEffect, useRef, useState, type ReactNode } from 'react';

interface LazyMountProps {
  children: ReactNode;
  /** Reserve space before mount to avoid layout shift. */
  minHeight?: number;
  /** Root margin so content mounts slightly before it enters view. */
  rootMargin?: string;
}

/**
 * Defers rendering its children until they are about to scroll into view.
 * Keeps initial JS/DOM/animation work small — important on low-end devices
 * where mounting every homepage section (and its ScrollTriggers) up front
 * causes a slow first paint. Once mounted, it stays mounted.
 */
export function LazyMount({ children, minHeight = 400, rootMargin = '400px' }: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;

    // Fallback: if IntersectionObserver is unavailable, render immediately.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, rootMargin]);

  return <div ref={ref} style={shown ? undefined : { minHeight }}>{shown ? children : null}</div>;
}
