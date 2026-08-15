import { describe, expect, it } from 'vitest';
import { bidIncrement } from '../../src/modules/auctions/increment.js';
import {
  computeProxy,
  deriveStatus,
  isReserveMet,
  minRequiredBid,
} from '../../src/modules/auctions/proxy-engine.js';

// A bare auction state; override per case.
const state = (over = {}) => ({
  startPrice: 100_000,
  currentBid: 100_000,
  leaderMaxBid: null,
  currentBidderId: null,
  reservePrice: null,
  reserveMet: false,
  ...over,
});

describe('bidIncrement table (VND)', () => {
  it('picks the bracket increment', () => {
    expect(bidIncrement(50_000)).toBe(5_000);
    expect(bidIncrement(100_000)).toBe(20_000);
    expect(bidIncrement(999_999)).toBe(20_000);
    expect(bidIncrement(1_000_000)).toBe(100_000);
    expect(bidIncrement(9_999_999)).toBe(100_000);
    expect(bidIncrement(10_000_000)).toBe(500_000);
    expect(bidIncrement(100_000_000)).toBe(1_000_000);
  });
});

describe('minRequiredBid', () => {
  it('is the start price with no bids, then current + increment', () => {
    expect(minRequiredBid(state())).toBe(100_000);
    expect(
      minRequiredBid(
        state({
          currentBid: 220_000,
          currentBidderId: 'A',
          leaderMaxBid: 300_000,
        }),
      ),
    ).toBe(240_000);
  });
});

describe('computeProxy — the worked example (start 100k)', () => {
  it('1) first bid leads at the start price, max hidden', () => {
    const r = computeProxy(state(), 'A', 300_000);
    expect(r.valid).toBe(true);
    expect(r.next.currentBid).toBe(100_000);
    expect(r.next.leaderMaxBid).toBe(300_000);
    expect(String(r.next.currentBidderId)).toBe('A');
    expect(r.outcome).toBe('LEADING');
    expect(r.displacedBidderId).toBeNull();
  });

  it('2) a lower max is instantly outbid; price rises one increment, leader unchanged', () => {
    const s = state({
      currentBid: 100_000,
      leaderMaxBid: 300_000,
      currentBidderId: 'A',
    });
    const r = computeProxy(s, 'B', 200_000);
    expect(r.valid).toBe(true);
    expect(r.outcome).toBe('OUTBID');
    expect(r.next.currentBid).toBe(220_000);
    expect(String(r.next.currentBidderId)).toBe('A');
    expect(r.leaderChanged).toBe(false);
  });

  it('3) a higher max takes the lead one increment above the old max, displacing the leader', () => {
    const s = state({
      currentBid: 220_000,
      leaderMaxBid: 300_000,
      currentBidderId: 'A',
    });
    const r = computeProxy(s, 'C', 400_000);
    expect(r.valid).toBe(true);
    expect(r.outcome).toBe('LEADING');
    expect(r.next.currentBid).toBe(320_000);
    expect(String(r.next.currentBidderId)).toBe('C');
    expect(r.leaderChanged).toBe(true);
    expect(r.displacedBidderId).toBe('A');
  });
});

describe('computeProxy — equal-max tie', () => {
  it('the earlier bidder keeps the lead; price rises to the tie amount', () => {
    const s = state({
      currentBid: 220_000,
      leaderMaxBid: 300_000,
      currentBidderId: 'A',
    });
    const r = computeProxy(s, 'B', 300_000);
    expect(r.outcome).toBe('OUTBID');
    expect(String(r.next.currentBidderId)).toBe('A');
    expect(r.next.currentBid).toBe(300_000);
  });
});

describe('computeProxy — self-raise', () => {
  it('raising your own max does not raise the price or displace you', () => {
    const s = state({
      currentBid: 220_000,
      leaderMaxBid: 300_000,
      currentBidderId: 'A',
    });
    const r = computeProxy(s, 'A', 500_000);
    expect(r.valid).toBe(true);
    expect(r.leaderChanged).toBe(false);
    expect(r.next.currentBid).toBe(220_000);
    expect(r.next.leaderMaxBid).toBe(500_000);
  });

  it('rejects a self-raise that does not exceed the current max', () => {
    const s = state({
      currentBid: 220_000,
      leaderMaxBid: 300_000,
      currentBidderId: 'A',
    });
    const r = computeProxy(s, 'A', 300_000);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('BELOW_CURRENT_MAX');
  });
});

describe('computeProxy — too-low bids', () => {
  it('rejects a first bid below the start price', () => {
    const r = computeProxy(state({ currentBid: 100_000 }), 'A', 90_000);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('BELOW_MIN');
    expect(r.minRequired).toBe(100_000);
  });

  it('rejects a challenger below current + increment', () => {
    const s = state({
      currentBid: 220_000,
      leaderMaxBid: 300_000,
      currentBidderId: 'A',
    });
    const r = computeProxy(s, 'B', 230_000);
    expect(r.valid).toBe(false);
    expect(r.minRequired).toBe(240_000);
  });
});

describe('computeProxy — reserve rule', () => {
  const reserved = (over) =>
    state({
      startPrice: 2_000_000,
      currentBid: 2_000_000,
      reservePrice: 5_000_000,
      ...over,
    });

  it('a max below the reserve leaves reserve not met and normal pricing', () => {
    const r = computeProxy(reserved(), 'A', 3_000_000);
    expect(r.next.currentBid).toBe(2_000_000);
    expect(r.next.reserveMet).toBe(false);
  });

  it('a max at/above the reserve jumps the price to the reserve and meets it', () => {
    // Leader A at max 3M (reserve not met), then B bids 6M (>= reserve).
    const s = reserved({
      currentBid: 2_000_000,
      leaderMaxBid: 3_000_000,
      currentBidderId: 'A',
    });
    const r = computeProxy(s, 'B', 6_000_000);
    expect(r.outcome).toBe('LEADING');
    expect(r.next.currentBid).toBe(5_000_000);
    expect(r.next.reserveMet).toBe(true);
    expect(String(r.next.currentBidderId)).toBe('B');
  });

  it('never lifts the price above the leader max', () => {
    const s = reserved({
      currentBid: 2_000_000,
      leaderMaxBid: null,
      currentBidderId: null,
    });
    const r = computeProxy(s, 'A', 4_500_000); // below reserve
    expect(r.next.reserveMet).toBe(false);
    expect(r.next.currentBid).toBe(2_000_000);
  });
});

describe('isReserveMet', () => {
  it('no reserve always counts as met', () => {
    expect(isReserveMet({ reservePrice: null }, 100)).toBe(true);
  });
  it('met only when the leader max reaches the reserve', () => {
    expect(isReserveMet({ reservePrice: 500 }, 400)).toBe(false);
    expect(isReserveMet({ reservePrice: 500 }, 500)).toBe(true);
  });
});

describe('deriveStatus', () => {
  const now = new Date('2030-01-01T00:00:00Z');
  const at = (offsetMs) => new Date(now.getTime() + offsetMs);
  it('is SCHEDULED before start, OPEN during, CLOSED after end or when stored CLOSED', () => {
    expect(
      deriveStatus(
        { status: 'OPEN', startsAt: at(1000), endsAt: at(5000) },
        now,
      ),
    ).toBe('SCHEDULED');
    expect(
      deriveStatus(
        { status: 'OPEN', startsAt: at(-1000), endsAt: at(5000) },
        now,
      ),
    ).toBe('OPEN');
    expect(
      deriveStatus(
        { status: 'OPEN', startsAt: at(-5000), endsAt: at(-1000) },
        now,
      ),
    ).toBe('CLOSED');
    expect(
      deriveStatus(
        { status: 'CLOSED', startsAt: at(-5000), endsAt: at(5000) },
        now,
      ),
    ).toBe('CLOSED');
  });
});
