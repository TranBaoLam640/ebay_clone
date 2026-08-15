import { logger } from '../../config/logger.js';
import { closeEndedAuctions } from './auction.service.js';

/**
 * In-process sweep that closes auctions whose end time has passed, without a
 * cron or queue. Runs on every pod; correctness is preserved because each close
 * is an atomic OPEN→CLOSED claim — only one pod's claim wins per auction, so
 * there is exactly one winner, order, and notification regardless of replicas.
 * Lazy-close-on-read (in the service reads) covers the gap between ticks.
 *
 * The timer is unref'd so it never keeps the process alive during shutdown.
 */
export const startAuctionSweep = (intervalMs) => {
  const tick = async () => {
    try {
      const closed = await closeEndedAuctions();
      if (closed > 0) logger.info({ closed }, 'auction sweep closed auctions');
    } catch (error) {
      logger.error({ error }, 'auction sweep failed');
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return timer;
};
