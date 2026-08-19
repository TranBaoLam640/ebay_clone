import { logger } from '../../config/logger.js';
import { processAutomatedPositiveFeedback } from './seller-feedback.service.js';

export const startAutomatedFeedbackSweep = ({ delayMs, intervalMs }) => {
  const tick = async () => {
    try {
      const { created } = await processAutomatedPositiveFeedback({ delayMs });
      if (created > 0)
        logger.info({ created }, 'automated seller feedback sweep created');
    } catch (error) {
      logger.error({ error }, 'automated seller feedback sweep failed');
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return timer;
};
