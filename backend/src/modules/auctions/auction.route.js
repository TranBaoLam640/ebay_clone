import { Router } from 'express';
import {
  authenticate,
  optionalAuthenticate,
} from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './auction.controller.js';
import {
  bidHistorySchema,
  bidStatusSchema,
  buyNowSchema,
  placeBidSchema,
} from './auction.validation.js';

// Nested under /products/:productId — auction actions on a specific listing.
export const nestedAuctionRoute = Router();
// Public, but optionally authenticated: a signed-in bidder sees their own name
// in full while every other bidder stays masked.
nestedAuctionRoute.get(
  '/:productId/bids',
  optionalAuthenticate,
  validate(bidHistorySchema),
  controller.bidHistory,
);
nestedAuctionRoute.post(
  '/:productId/bids',
  authenticate,
  validate(placeBidSchema),
  controller.placeBid,
);
nestedAuctionRoute.get(
  '/:productId/bid-status',
  authenticate,
  validate(bidStatusSchema),
  controller.bidStatus,
);
nestedAuctionRoute.post(
  '/:productId/buy-now',
  authenticate,
  validate(buyNowSchema),
  controller.buyNow,
);

// Buyer's own bids, mounted at /me. Per-route auth (not a router-level `.use`)
// so this router shares the /me mount with other /me routers without running
// authenticate on requests that fall through to them.
export const auctionMeRoute = Router();
auctionMeRoute.get('/bids', authenticate, controller.myBids);
