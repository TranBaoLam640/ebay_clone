import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './inr-request.controller.js';
import {
  createSchema,
  idSchema,
  listSchema,
  refundPreviewSchema,
  refundSchema,
  trackingEvidenceSchema,
} from './inr-request.validation.js';

export const inrRequestRoute = Router();
inrRequestRoute.use(authenticate);
inrRequestRoute.post('/', validate(createSchema), controller.create);
inrRequestRoute.get('/', validate(listSchema), controller.listBuyer);
inrRequestRoute.get('/seller', validate(listSchema), controller.listSeller);
inrRequestRoute.get(
  '/:requestId/refund-preview',
  validate(refundPreviewSchema),
  controller.refundPreview,
);
inrRequestRoute.post(
  '/:requestId/refund',
  validate(refundSchema),
  controller.refund,
);
inrRequestRoute.get('/:requestId', validate(idSchema), controller.get);
inrRequestRoute.patch(
  '/:requestId/close',
  validate(idSchema),
  controller.close,
);
inrRequestRoute.patch(
  '/:requestId/tracking-evidence',
  validate(trackingEvidenceSchema),
  controller.updateTrackingEvidence,
);
