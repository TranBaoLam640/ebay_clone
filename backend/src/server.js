import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './config/logger.js';
import { startAuctionSweep } from './modules/auctions/auction-sweep.js';
import { initSocket } from './socket/socket.js';
const start = async () => {
  await connectDatabase();
  startAuctionSweep(env.AUCTION_SWEEP_INTERVAL_MS);
  const server = app.listen(env.PORT, () =>
    logger.info({ port: env.PORT }, 'server started'),
  );
  initSocket(server);
  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};
start().catch((error) => {
  logger.fatal({ error }, 'startup failed');
  process.exit(1);
});
