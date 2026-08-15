import { useMemo } from 'react';

export type DeviceTier = 'low' | 'high';

/**
 * Classifies the device so heavy visual effects (large blur, scroll parallax,
 * pointer tilt, continuous tweens) can be disabled on weak hardware.
 *
 * A device is 'low' when ANY of:
 *  - prefers-reduced-motion is set (respect user intent)
 *  - navigator.deviceMemory <= 4 (GB)
 *  - navigator.hardwareConcurrency <= 2 (logical cores)
 *  - coarse pointer + small viewport (typical low-end phones)
 *
 * These APIs are not universal; when unknown we assume 'high' so capable
 * browsers (e.g. Safari, which hides deviceMemory) still get the full design.
 */
export function useDeviceTier(): DeviceTier {
  return useMemo(() => detectTier(), []);
}

function detectTier(): DeviceTier {
  if (typeof window === 'undefined') return 'high';

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return 'low';

  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory; // GB, coarse (0.25–8), Chromium only
  const cores = navigator.hardwareConcurrency; // logical cores

  if (typeof mem === 'number' && mem <= 4) return 'low';
  if (typeof cores === 'number' && cores <= 2) return 'low';

  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && window.innerWidth < 640) return 'low';

  return 'high';
}

/** True when the device can afford full-fidelity motion/effects. */
export function useHighFidelity(): boolean {
  return useDeviceTier() === 'high';
}
