import { useEffect, useState } from 'react';

export interface Countdown {
  ended: boolean;
  /** Human parts for a "2d 3h 5m 10s" style display. */
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

const parts = (endsAt: string): Countdown => {
  const totalMs = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const totalSec = Math.floor(totalMs / 1000);
  return {
    ended: totalMs <= 0,
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    totalMs,
  };
};

/**
 * Local 1-second countdown to `endsAt`. Display-only: it ticks smoothly between
 * the 5s availability polls, and each poll re-supplies the authoritative
 * server `endsAt` so drift can't accumulate. Emits `ended` at zero.
 */
export function useCountdown(endsAt: string | undefined): Countdown {
  const [state, setState] = useState<Countdown>(() =>
    endsAt ? parts(endsAt) : { ended: true, days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 },
  );

  useEffect(() => {
    if (!endsAt) return;
    setState(parts(endsAt));
    const timer = setInterval(() => {
      const next = parts(endsAt);
      setState(next);
      if (next.ended) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  return state;
}
