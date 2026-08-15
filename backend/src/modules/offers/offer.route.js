import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './offer.controller.js';
import { createOfferSchema, offerIdSchema } from './offer.validation.js';

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
