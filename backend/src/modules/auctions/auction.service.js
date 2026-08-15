import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import * as productRepository from '../products/product.repository.js';
import * as orderRepository from '../orders/order.repository.js';
import * as auctionRepository from './auction.repository.js';
import * as bidRepository from './bid.repository.js';
import * as userRepository from '../users/repository.js';
import {
  computeProxy,
  deriveStatus,
  isBuyNowAvailable,
  minRequiredBid,
} from './proxy-engine.js';
import {
  notifyBoughtOut,
  notifyOutbid,
  notifyWon,
} from './auction.notifications.js';
import { logger } from '../../config/logger.js';

// Bounded retry for the optimistic-concurrency loop. Exactly one racer commits
// per round (the version CAS lets only one of N concurrent writers win), so a
// bid retries at most (concurrency - 1) times — never a livelock. The budget is
// generous enough to absorb a burst of simultaneous bidders on one auction.
const MAX_BID_RETRIES = 50;

const notFound = () =>
  new AppError(404, ERROR_CODES.AUCTION_NOT_FOUND, 'Auction not found');

// Resolve a public uuid → { productId } or throw 404.
const resolveProductId = async (productUuid) => {
  const productId = await productRepository.resolveIdByUuid(productUuid);
  if (!productId) throw notFound();
  return productId;
};

// -- Serialization (never leaks hidden max, leader id, reserve amount) --------

const baseSnapshot = (product, now) => {
  const auction = product.auction;
  const status = deriveStatus(auction, now);
  const hasReserve = auction.reservePrice != null;
  const buyNowAvailable = isBuyNowAvailable(auction, status);
  return {
    listingType: 'AUCTION',
    status,
    currentBid: auction.currentBid,
    bidCount: auction.bidCount,
    startsAt: auction.startsAt,
    endsAt: auction.endsAt,
    minNextBid: minRequiredBid(auction),
    hasReserve,
    reserveMet: auction.reserveMet,
    buyNowAvailable,
    ...(auction.buyNowPrice != null && { buyNowPrice: auction.buyNowPrice }),
    ...(status === 'CLOSED' && { finalPrice: auction.finalPrice ?? null }),
  };
};

const withViewer = (snapshot, product, userId) => {
  const auction = product.auction;
  const leaderId = auction.currentBidderId
    ? String(auction.currentBidderId)
    : null;
  const winnerId = auction.winnerId ? String(auction.winnerId) : null;
  const viewer = String(userId);
  return {
    ...snapshot,
    youAreHighBidder: snapshot.status === 'OPEN' && leaderId === viewer,
    won: snapshot.status === 'CLOSED' && winnerId === viewer,
  };
};

// -- Placement (Phase 2: concurrency-safe proxy bid) -------------------------

export const placeBid = async ({ productUuid, bidderId, maxBid }) => {
  const productId = await resolveProductId(productUuid);

  for (let attempt = 0; attempt < MAX_BID_RETRIES; attempt += 1) {
    const now = new Date();
    const product = await auctionRepository.findAuctionState(productId);
    if (!product || !product.auction) throw notFound();

    const status = deriveStatus(product.auction, now);
    if (status !== 'OPEN') {
      // Ended but still stored OPEN → close it lazily, then reject the bid.
      if (product.auction.status === 'OPEN' && now >= product.auction.endsAt)
        await closeAuction(productId, now);
      throw new AppError(
        409,
        ERROR_CODES.AUCTION_NOT_OPEN,
        'This auction is not open for bidding',
      );
    }

    const result = computeProxy(product.auction, bidderId, maxBid);
    if (!result.valid)
      throw new AppError(
        422,
        ERROR_CODES.BID_TOO_LOW,
        'Your bid is below the minimum acceptable amount',
        { minRequired: result.minRequired },
      );

    const updated = await auctionRepository.commitBid(
      productId,
      product.auction.version,
      result.next,
      now,
    );
    // Lost the version race (or it just closed) — re-read and recompute.
    if (!updated) continue;

    // Committed. Append history + notify the displaced leader as best-effort
    // side effects: the authoritative auction state is already persisted, so a
    // transient failure here must NOT turn a successful bid into an error. The
    // version-keyed outbid eventKey keeps the notification idempotent, and the
    // 5s bid-status poll reconciles the client regardless.
    try {
      await bidRepository.create({
        productId,
        bidderId,
        maxBid,
        amountAtBid: result.amountAtBid,
        outcome: result.outcome,
      });
      // Instant outbid: the standing leader's proxy auto-bids up to keep the
      // lead, raising the displayed price. Record that automatic bid as its own
      // LEADING row so the history's top entry matches the current price (eBay
      // shows these auto-bids). The leader is unchanged, so currentBidderId is
      // still the leader. The challenger's row above stays at their own max, so
      // the two rows read as distinct prices rather than a duplicated one.
      if (result.outcome === 'OUTBID')
        await bidRepository.create({
          productId,
          bidderId: updated.auction.currentBidderId,
          maxBid: updated.auction.currentBid,
          amountAtBid: updated.auction.currentBid,
          outcome: 'LEADING',
        });
      if (result.leaderChanged && result.displacedBidderId)
        await notifyOutbid(
          result.displacedBidderId,
          product,
          updated.auction.version,
        );
    } catch (error) {
      logger.error(
        { error, productId: String(productId) },
        'auction bid committed but post-commit side effect failed',
      );
    }

    const snapshot = withViewer(baseSnapshot(updated, now), updated, bidderId);
    return {
      ...snapshot,
      outcome: result.outcome,
      yourMaxBid: maxBid,
      hasBid: true,
    };
  }

  throw new AppError(
    409,
    ERROR_CODES.AUCTION_CONTENTION,
    'The auction is receiving many bids right now — please try again',
  );
};

// -- Buy It Now (Phase 3) ----------------------------------------------------

export const buyNow = async ({ productUuid, buyerId }) => {
  const productId = await resolveProductId(productUuid);
  const now = new Date();
  const claim = await auctionRepository.buyNowAtomic(productId, buyerId, now);
  if (!claim)
    throw new AppError(
      409,
      ERROR_CODES.BUY_NOW_UNAVAILABLE,
      'Buy It Now is no longer available for this auction',
    );
  const { product: claimed, priorLeaderId } = claim;
  const order = await createOrderForWin(claimed);

  // Best-effort, same as placeBid: the sale and its order are already persisted,
  // so a failing notification must not turn a completed purchase into a 5xx the
  // buyer cannot retry (the auction is CLOSED, so a retry would only 409).
  try {
    await notifyWon(buyerId, claimed, claimed.auction.finalPrice);
    // On a reserve listing BIN can land while bids stand, so the leader at the
    // instant of the claim loses the item without ever having been outbid —
    // nothing else would tell them. `priorLeaderId` comes from the claim's own
    // before-image, so it names whoever actually held the lead.
    if (priorLeaderId && String(priorLeaderId) !== String(buyerId))
      await notifyBoughtOut(priorLeaderId, claimed);
  } catch (error) {
    logger.error(
      { error, productId: String(productId) },
      'buy it now committed but notification failed',
    );
  }
  // Return the created win order's id so the client can send the buyer straight
  // to checkout (choose address + pay), mirroring eBay's Buy It Now → checkout.
  return {
    ...withViewer(baseSnapshot(claimed, now), claimed, buyerId),
    orderId: order ? String(order._id) : null,
  };
};

// -- Close + won-to-checkout (Phase 3) ---------------------------------------

/**
 * Idempotently create the winner's PENDING_PAYMENT order at the final price.
 * The order carries no checkoutGroupId (marking it an auction win) and no
 * shippingAddress — the winner attaches an address at pay time via the existing
 * order/payment flow.
 */
const createOrderForWin = async (product) => {
  const auction = product.auction;
  if (!auction.winnerId || auction.finalPrice == null) return null;
  const existing = await orderRepository.findAuctionWinOrder(
    auction.winnerId,
    product._id,
  );
  if (existing) return existing;
  const [order] = await orderRepository.createMany([
    {
      buyerId: auction.winnerId,
      sellerId: product.sellerId,
      orderStatus: 'PENDING_PAYMENT',
      subtotal: auction.finalPrice,
      discount: 0,
      shippingFee: 0,
      total: auction.finalPrice,
      currency: 'VND',
      items: [
        {
          productId: product._id,
          sellerId: product.sellerId,
          quantity: 1,
          title: product.title,
          image: product.images?.[0],
          unitPrice: auction.finalPrice,
          itemSubtotal: auction.finalPrice,
        },
      ],
    },
  ]);
  return order;
};

/**
 * Close one ended auction. The atomic claim guarantees a single winner-claim
 * across every racing sweep/lazy-close, so the order and You-Won notification
 * happen exactly once. Returns the closed product, or null if already closed.
 */
export const closeAuction = async (productId, now = new Date()) => {
  const closed = await auctionRepository.closeAuctionAtomic(productId, now);
  if (!closed) return null;
  if (closed.auction.winnerId) {
    await createOrderForWin(closed);
    await notifyWon(closed.auction.winnerId, closed, closed.auction.finalPrice);
  }
  return closed;
};

// Close every auction whose end time has passed (the sweep body).
export const closeEndedAuctions = async (now = new Date()) => {
  const candidates = await auctionRepository.findClosableIds(now);
  let closed = 0;
  for (const { _id } of candidates)
    if (await closeAuction(_id, now)) closed += 1;
  return closed;
};

// -- Reads -------------------------------------------------------------------

// Public auction snapshot for the product-detail page (no viewer context).
export const publicSnapshot = async (productUuid) => {
  const productId = await resolveProductId(productUuid);
  const now = new Date();
  let product = await auctionRepository.findAuctionState(productId);
  if (!product || !product.auction) throw notFound();
  if (product.auction.status === 'OPEN' && now >= product.auction.endsAt) {
    const closed = await closeAuction(productId, now);
    if (closed) product = closed;
  }
  return baseSnapshot(product, now);
};

// Authenticated per-buyer status for the banner + buy-box.
export const getBidStatus = async (productUuid, userId) => {
  const productId = await resolveProductId(productUuid);
  const now = new Date();
  let product = await auctionRepository.findAuctionState(productId);
  if (!product || !product.auction) throw notFound();
  if (product.auction.status === 'OPEN' && now >= product.auction.endsAt) {
    const closed = await closeAuction(productId, now);
    if (closed) product = closed;
  }
  const [hasBid, yourMaxBid] = await Promise.all([
    bidRepository.existsForBidder(productId, userId),
    bidRepository.myMaxOnProduct(productId, userId),
  ]);
  return {
    ...withViewer(baseSnapshot(product, now), product, userId),
    hasBid: Boolean(hasBid),
    yourMaxBid,
  };
};

/**
 * Public bid history with redacted bidders. Amount rule (true eBay): once a
 * bidder is outbid, their max is revealed; the current leader's max stays
 * hidden (their rows show only the displayed price).
 *
 * `viewerId` is optional (the endpoint is public). When present, that bidder's
 * own rows show their full name and are flagged `isYou`, so they can find
 * themselves in the ladder — every other bidder stays masked exactly as before.
 */
export const getBidHistory = async (productUuid, viewerId = null) => {
  const productId = await resolveProductId(productUuid);
  const product = await auctionRepository.findAuctionState(productId);
  if (!product || !product.auction) throw notFound();
  const leaderId = product.auction.currentBidderId
    ? String(product.auction.currentBidderId)
    : null;
  const viewer = viewerId ? String(viewerId) : null;
  const [rows, bidderCount] = await Promise.all([
    bidRepository.listByProduct(productId),
    bidRepository.distinctBidderCount(productId),
  ]);
  // Redact by bidder name (eBay-style) rather than id. Batch-fetch the names for
  // the distinct bidders on this auction, then mask each.
  const bidderIds = [...new Set(rows.map((row) => String(row.bidderId)))];
  const users = await userRepository.findNamesByIds(bidderIds);
  const nameById = new Map(users.map((u) => [String(u._id), u.fullName]));

  // The public history is a displayed-price ladder: one row per (bidder, price)
  // that bidder reached. `rows` is newest-first, so for each (bidder, price) the
  // first seen is the newest — keep it, drop every older repeat. This collapses a
  // self-raise (same price, higher hidden max) and any other duplicate uniformly,
  // whether the bidder leads or was outbid, so the list never shows the same
  // person at the same price twice. Each row shows the displayed price it set;
  // no hidden max is ever revealed. Exactly one "Highest" tag marks the current
  // leader's top (newest) row.
  const seen = new Set();
  let leaderBadged = false;
  const bids = [];
  for (const row of rows) {
    const key = `${String(row.bidderId)}:${row.amountAtBid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const isLeader =
      row.outcome === 'LEADING' &&
      String(row.bidderId) === leaderId &&
      !leaderBadged;
    if (isLeader) leaderBadged = true;
    const isYou = viewer !== null && String(row.bidderId) === viewer;
    const name = nameById.get(String(row.bidderId));
    bids.push({
      maskedBidder: isYou ? (name ?? 'Bidder') : maskName(name),
      isYou,
      amount: row.amountAtBid,
      isLeader,
      createdAt: row.createdAt,
    });
  }
  return { bidCount: product.auction.bidCount, bidderCount, bids };
};

// Redact a bidder's display name eBay-style: keep the first and last visible
// character and mask the middle (e.g. "Buyer Demo" → "B***o"). Falls back to a
// neutral label when the name is missing.
const maskName = (name) => {
  const s = String(name ?? '').trim();
  if (s.length === 0) return 'Bidder';
  if (s.length <= 2) return `${s.slice(0, 1)}***`;
  return `${s.slice(0, 1)}***${s.slice(-1)}`;
};

// -- My Bids -----------------------------------------------------------------

export const listMyBids = async (buyerId) => {
  const now = new Date();
  const summaries = await bidRepository.myBidsSummary(buyerId);
  if (summaries.length === 0) return [];
  const productMap = await productRepository.findAuctionsByIds(
    summaries.map((s) => s._id),
  );
  const viewer = String(buyerId);
  return summaries
    .map((summary) => {
      const product = productMap.get(String(summary._id));
      if (!product || !product.auction) return null;
      const auction = product.auction;
      const status = deriveStatus(auction, now);
      const leaderId = auction.currentBidderId
        ? String(auction.currentBidderId)
        : null;
      const winnerId = auction.winnerId ? String(auction.winnerId) : null;
      const youAreHighBidder = status === 'OPEN' && leaderId === viewer;
      const won = status === 'CLOSED' && winnerId === viewer;
      // Was the leader at close but the reserve was never met → neutral state
      // (not "outbid" — nobody beat them; the seller's floor wasn't reached).
      const endedReserveNotMet =
        status === 'CLOSED' &&
        leaderId === viewer &&
        !auction.reserveMet &&
        !winnerId;
      return {
        productUuid: product.uuid,
        productTitle: product.title,
        productImage: product.images?.[0] ?? null,
        yourMaxBid: summary.yourMaxBid,
        currentBid: auction.currentBid,
        bidCount: auction.bidCount,
        endsAt: auction.endsAt,
        status,
        youAreHighBidder,
        won,
        endedReserveNotMet,
        finalPrice: won ? auction.finalPrice : null,
      };
    })
    .filter(Boolean);
};
