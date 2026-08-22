import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { maintainInrResolutionGuard } from '../modules/inr-requests/inr-resolution-guard.js';

try {
  await connectDatabase();
  const result = await maintainInrResolutionGuard();
  process.stdout.write(
    `INR resolution guard maintenance complete: ${JSON.stringify(result)}\n`,
  );
} catch (error) {
  process.stderr.write(
    `INR resolution guard maintenance failed: ${error.message}\n`,
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
