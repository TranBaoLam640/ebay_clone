import * as repository from './carrier.repository.js';

export const DEMO_CARRIERS = Object.freeze([
  { code: 'SBAY_EXPRESS', name: 'SBay Express', active: true },
  { code: 'DHL', name: 'DHL', active: true },
  { code: 'FEDEX', name: 'FedEx', active: true },
  { code: 'UPS', name: 'UPS', active: true },
]);

export const seedCarriers = () => repository.upsertMany(DEMO_CARRIERS);
