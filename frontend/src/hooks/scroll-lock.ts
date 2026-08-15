import type Lenis from 'lenis';

/**
 * Central scroll-lock used by overlays (modals, drawers).
 *
 * The app drives page scroll with Lenis (JS/transform-based), so plain
 * `overflow: hidden` on <html>/<body> does NOT stop it — Lenis keeps scrolling
 * via requestAnimationFrame. To truly freeze the background we must call
 * `lenis.stop()`. On low-tier devices Lenis is skipped and native scroll is
 * used, so we also pin overflow as a fallback for that path.
 *
 * Nested overlays are ref-counted so closing an inner one doesn't unlock while
 * an outer one is still open.
 */

let lenisInstance: Lenis | null = null;
let lockCount = 0;
let restore: (() => void) | null = null;

/** Registered by useLenis so the lock can pause/resume smooth scroll. */
export function setLenisInstance(instance: Lenis | null): void {
  lenisInstance = instance;
}

export function lockScroll(): void {
  lockCount += 1;
  if (lockCount > 1) return; // already locked by an outer overlay

  // Pause Lenis (adds the .lenis-stopped class + halts its rAF loop).
  lenisInstance?.stop();

  // Fallback for native scroll (Lenis disabled on low-tier devices): pin the
  // real scrollers and pad for the removed scrollbar to avoid a layout shift.
  const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
  const html = document.documentElement;
  const prevHtmlOverflow = html.style.overflow;
  const prevBodyOverflow = document.body.style.overflow;
  const prevBodyPad = document.body.style.paddingRight;
  html.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`;

  restore = () => {
    html.style.overflow = prevHtmlOverflow;
    document.body.style.overflow = prevBodyOverflow;
    document.body.style.paddingRight = prevBodyPad;
  };
}

export function unlockScroll(): void {
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0) return; // an outer overlay still holds the lock

  restore?.();
  restore = null;
  lenisInstance?.start();
}
