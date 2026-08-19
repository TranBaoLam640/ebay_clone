import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './offer.controller.js';
import { createOfferSchema, offerIdSchema } from './offer.validation.js';
import {
  conversationOfferSchema,
  counterOfferSchema,
} from './offer.validation.js';

// Nested under /products/:productId — make a Best Offer on a listing.
export const nestedOfferRoute = Router();
nestedOfferRoute.post(
  '/:productId/offers',
  authenticate,
  validate(createOfferSchema),
  controller.createOffer,
);

// Buyer's own offers, mounted at /me. Per-route auth (not a router-level `.use`)
// so it shares the /me mount with auctionMeRoute without double-authenticating
// requests that fall through between the two routers.
export const offerMeRoute = Router();
offerMeRoute.get('/offers', authenticate, controller.myOffers);
offerMeRoute.delete(
  '/offers/:offerId',
  authenticate,
  validate(offerIdSchema),
  controller.withdrawOffer,
);

export const offerActionRoute = Router();
offerActionRoute.post(
  '/:offerId/accept',
  authenticate,
  validate(offerIdSchema),
  controller.acceptOffer,
);
offerActionRoute.post(
  '/:offerId/decline',
  authenticate,
  validate(offerIdSchema),
  controller.declineOffer,
);
offerActionRoute.post(
  '/:offerId/retract',
  authenticate,
  validate(offerIdSchema),
  controller.retractOffer,
);
offerActionRoute.post(
  '/:offerId/counter',
  authenticate,
  validate(counterOfferSchema),
  controller.counterOffer,
);

export const conversationOfferRoute = Router({ mergeParams: true });
conversationOfferRoute.post(
  '/:id/offers',
  authenticate,
  validate(conversationOfferSchema),
  controller.createConversationOffer,
);
