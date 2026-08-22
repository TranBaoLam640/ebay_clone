import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { maintainShipmentIndexes } from '../modules/shipments/shipment-indexes.js';

try {
  await connectDatabase();
  const result = await maintainShipmentIndexes();
  process.stdout.write(
    `Shipment index maintenance complete: ${JSON.stringify(result)}\n`,
  );
} catch (error) {
  process.stderr.write(`Shipment index maintenance failed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
