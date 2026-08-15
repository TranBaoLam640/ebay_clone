import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// The graded centerpiece: many buyers bidding on the same auction at once must
// sync deterministically. These tests drive the service directly and fire truly
// concurrent operations via Promise.all against a real (in-memory) replica set.

let mongo;
let database;
let models;
let service;
let cartService;

const sellerId = new mongoose.Types.ObjectId('770000000000000000000001');
const categoryId = new mongoose.Types.ObjectId('770000000000000000000002');
const productId = new mongoose.Types.ObjectId('770000000000000000000010');
const productUuid = '77000000-0000-4000-8000-000000000010';

const bidderIds = Array.from(
  { length: 20 },
  (_, i) =>
    new mongoose.Types.ObjectId(
      `7700000000000000000001${String(i).padStart(2, '0')}`,
    ),
);

const seedAuction = async (over = {}) => {
  await models.Product.create({
    _id: productId,
    uuid: productUuid,
    sellerId,
    categoryId,
    title: 'Concurrency Auction',
    description: 'Auction under concurrent load',
    price: 1_000_000,
    stock: 1,
    status: 'ACTIVE',
    listingType: 'AUCTION',
    images: ['https://example.test/a.jpg'],
    auction: {
      startPrice: 1_000_000,
      currentBid: 1_000_000,
      bidCount: 0,
      version: 0,
      status: 'OPEN',
      reserveMet: true,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 60 * 60_000),
      ...over,
    },
  });
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  database = await import('../../src/config/database.js');
  await database.connectDatabase(process.env.MONGODB_URI);
  const [
    productModel,
    notificationModel,
    orderModel,
    bidModel,
    offerModel,
    sellerModel,
    categoryModel,
    cartModel,
    userModel,
    svc,
    cartSvc,
  ] = await Promise.all([
    import('../../src/modules/products/product.model.js'),
    import('../../src/modules/notifications/notification.model.js'),
    import('../../src/modules/orders/order.model.js'),
    import('../../src/modules/auctions/bid.model.js'),
    import('../../src/modules/offers/offer.model.js'),
    import('../../src/modules/sellers/seller-profile.model.js'),
    import('../../src/modules/categories/category.model.js'),
    import('../../src/modules/carts/cart.model.js'),
    import('../../src/modules/users/user.model.js'),
    import('../../src/modules/auctions/auction.service.js'),
    import('../../src/modules/carts/cart.service.js'),
  ]);
  models = {
    Product: productModel.Product,
    Notification: notificationModel.Notification,
    Order: orderModel.Order,
    Bid: bidModel.Bid,
    Offer: offerModel.Offer,
    SellerProfile: sellerModel.SellerProfile,
    Category: categoryModel.Category,
    Cart: cartModel.Cart,
    User: userModel.User,
  };
  service = svc;
  cartService = cartSvc;
  await Promise.all(Object.values(models).map((m) => m.init()));
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})),
  );
});

afterAll(async () => {
  await database.disconnectDatabase();
  await mongo.stop();
});

describe('concurrent bids on one auction', () => {
  it('produce a single leader, exact bid count, monotonic price, and no duplicate outbid notifications', async () => {
    await seedAuction();
    // Well-separated maxes (2M..21M, 1M apart) so the highest always clears the
    // minimum regardless of arrival order. Shuffle so no ordering is implied.
    const maxes = bidderIds.map((id, i) => ({
      id,
      maxBid: (i + 2) * 1_000_000,
    }));
    const shuffled = [...maxes].sort((a, b) => (a.maxBid % 3) - (b.maxBid % 3));

    const results = await Promise.allSettled(
      shuffled.map(({ id, maxBid }) =>
        service.placeBid({ productUuid, bidderId: id, maxBid }),
      ),
    );
    const accepted = results.filter((r) => r.status === 'fulfilled').length;

    const product = await models.Product.findById(productId).lean();
    const auction = product.auction;
    const bids = await models.Bid.find({ productId })
      .sort({ createdAt: 1 })
      .lean();

    // Exact bid count: every accepted placeBid bumps the auction bidCount once,
    // and each instant-outbid also appends one autobid LEADING row for the
    // standing leader — so the history has one row per bid plus one per outbid.
    const outbidRows = bids.filter((b) => b.outcome === 'OUTBID').length;
    expect(bids.length).toBe(accepted + outbidRows);
    expect(auction.bidCount).toBe(accepted);

    // Single leader, and it is the highest-max bidder (21M).
    const topBidder = maxes.reduce((a, b) => (b.maxBid > a.maxBid ? b : a));
    expect(String(auction.currentBidderId)).toBe(String(topBidder.id));

    // Monotonic price: since each commit only ever raises the displayed price,
    // the final auction price equals the highest amount ever recorded, sits at
    // or above the start, and never exceeds the winning max. (History rows are
    // appended after each CAS commits, so their timestamps don't track commit
    // order — the max is the order-independent invariant.)
    const amounts = bids.map((b) => b.amountAtBid);
    expect(auction.currentBid).toBe(Math.max(...amounts));
    expect(auction.currentBid).toBeGreaterThanOrEqual(1_000_000);
    expect(auction.currentBid).toBeLessThanOrEqual(topBidder.maxBid);

    // No duplicate outbid notifications, and the final leader was never outbid.
    const outbid = await models.Notification.find({
      type: 'AUCTION',
      eventType: 'AUCTION_OUTBID',
    }).lean();
    const keys = outbid.map((n) => n.eventKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(outbid.some((n) => String(n.userId) === String(topBidder.id))).toBe(
      false,
    );
  });

  it('records a deterministic price when two known maxes compete', async () => {
    await seedAuction();
    const [a, b] = bidderIds;
    // A leads at 3M max; B challenges with 5M → B leads at A's max + increment.
    await service.placeBid({ productUuid, bidderId: a, maxBid: 3_000_000 });
    const r = await service.placeBid({
      productUuid,
      bidderId: b,
      maxBid: 5_000_000,
    });
    // increment at 3M is 100k → displayed 3.1M.
    expect(r.currentBid).toBe(3_100_000);
    expect(r.youAreHighBidder).toBe(true);
    const product = await models.Product.findById(productId).lean();
    expect(String(product.auction.currentBidderId)).toBe(String(b));
    expect(product.auction.currentBid).toBe(3_100_000);
  });

  it('shows an instantly-outbid challenger at their own bid, not the leader autobid price', async () => {
    await seedAuction();
    const [leader, challenger] = bidderIds;
    // Leader hides a 1.5M max; the challenger bids 1.4M and is instantly
    // outbid. Increment at 1.4M is 100k, so the leader's autobid lands exactly
    // on 1.5M — the case where reusing the post-commit price for the
    // challenger's row made both rows read 1.5M.
    await service.placeBid({ productUuid, bidderId: leader, maxBid: 1_500_000 });
    const r = await service.placeBid({
      productUuid,
      bidderId: challenger,
      maxBid: 1_400_000,
    });
    expect(r.outcome).toBe('OUTBID');
    expect(r.currentBid).toBe(1_500_000);

    const rows = await models.Bid.find({ productId, bidderId: challenger })
      .sort({ createdAt: -1 })
      .lean();
    expect(rows[0].amountAtBid).toBe(1_400_000);

    const history = await service.getBidHistory(productUuid);
    const amounts = history.bids.map((b) => b.amount);
    expect(amounts).toContain(1_400_000);
    expect(amounts.filter((a) => a === 1_500_000).length).toBe(1);
  });

  it('unmasks only the viewer own name in bid history', async () => {
    await seedAuction();
    const [leader, challenger] = bidderIds;
    await models.User.create([
      {
        _id: leader,
        email: 'nguyen@example.test',
        passwordHash: 'x',
        fullName: 'Nguyen Van A',
      },
      {
        _id: challenger,
        email: 'huy@example.test',
        passwordHash: 'x',
        fullName: 'Huy Tran',
      },
    ]);
    await service.placeBid({ productUuid, bidderId: leader, maxBid: 1_500_000 });
    await service.placeBid({
      productUuid,
      bidderId: challenger,
      maxBid: 1_400_000,
    });

    // Anonymous viewer: everyone masked, nobody flagged as self.
    const anon = await service.getBidHistory(productUuid);
    expect(anon.bids.map((b) => b.maskedBidder)).toEqual(
      expect.arrayContaining(['N***A', 'H***n']),
    );
    expect(anon.bids.every((b) => b.isYou === false)).toBe(true);

    // The challenger sees their own full name; the leader stays masked.
    const mine = await service.getBidHistory(productUuid, challenger);
    const own = mine.bids.filter((b) => b.isYou);
    expect(own.length).toBe(1);
    expect(own[0].maskedBidder).toBe('Huy Tran');
    expect(own[0].amount).toBe(1_400_000);
    expect(
      mine.bids.filter((b) => !b.isYou).every((b) => b.maskedBidder === 'N***A'),
    ).toBe(true);
    expect(mine.bids.some((b) => b.maskedBidder === 'Nguyen Van A')).toBe(false);
  });
});

describe('Buy It Now vs first bid race', () => {
  it('lets exactly one win; the other is rejected', async () => {
    await seedAuction({ buyNowPrice: 3_000_000 });
    const [buyer, bidder] = bidderIds;
    const [buyRes, bidRes] = await Promise.allSettled([
      service.buyNow({ productUuid, buyerId: buyer }),
      service.placeBid({ productUuid, bidderId: bidder, maxBid: 1_500_000 }),
    ]);

    const product = await models.Product.findById(productId).lean();
    const orders = await models.Order.find({
      'items.productId': productId,
    }).lean();

    if (buyRes.status === 'fulfilled') {
      // BIN won: closed with the buyer as winner, one order, bid rejected.
      expect(product.auction.status).toBe('CLOSED');
      expect(String(product.auction.winnerId)).toBe(String(buyer));
      expect(product.auction.bidCount).toBe(0);
      expect(bidRes.status).toBe('rejected');
      expect(orders.length).toBe(1);
    } else {
      // The bid landed first: BIN is gone, auction still open with one bid.
      expect(bidRes.status).toBe('fulfilled');
      expect(product.auction.status).toBe('OPEN');
      expect(product.auction.bidCount).toBe(1);
    }
  });
});

describe('Buy It Now on a reserve listing', () => {
  // eBay's rule: the first bid normally retires Buy It Now, but on a reserve
  // listing it stays on offer until a bid actually reaches the seller's floor.
  const seedReserveBuyNow = () =>
    seedAuction({
      reservePrice: 5_000_000,
      reserveMet: false,
      buyNowPrice: 8_000_000,
    });

  it('stays available after a bid that misses the reserve', async () => {
    await seedReserveBuyNow();
    await service.placeBid({
      productUuid,
      bidderId: bidderIds[0],
      maxBid: 2_000_000,
    });

    const snapshot = await service.publicSnapshot(productUuid);
    expect(snapshot.bidCount).toBe(1);
    expect(snapshot.reserveMet).toBe(false);
    expect(snapshot.buyNowAvailable).toBe(true);
  });

  it('closes the auction for the buyer and tells the standing leader', async () => {
    await seedReserveBuyNow();
    const [leader, buyer] = bidderIds;
    await service.placeBid({ productUuid, bidderId: leader, maxBid: 2_000_000 });
    const result = await service.buyNow({ productUuid, buyerId: buyer });

    expect(result.status).toBe('CLOSED');
    expect(result.finalPrice).toBe(8_000_000);

    const product = await models.Product.findById(productId).lean();
    expect(String(product.auction.winnerId)).toBe(String(buyer));
    // The bid that never met the reserve is still on the record.
    expect(product.auction.bidCount).toBe(1);
    // A buy-out is not a bid: the reserve was never actually reached, and the
    // closed record must not claim otherwise.
    expect(product.auction.reserveMet).toBe(false);
    // The leader of record moved to the buyer, so their hidden ceiling must move
    // too — leaving it behind would attribute the outbid bidder's max to the buyer.
    expect(String(product.auction.currentBidderId)).toBe(String(buyer));
    expect(product.auction.leaderMaxBid).toBe(8_000_000);

    const orders = await models.Order.find({ buyerId: buyer }).lean();
    expect(orders.length).toBe(1);
    expect(orders[0].total).toBe(8_000_000);

    // The leader lost the item without ever being outbid — they get their own
    // notice rather than silence.
    const notices = await models.Notification.find({
      userId: leader,
      eventType: 'AUCTION_BOUGHT_OUT',
    }).lean();
    expect(notices.length).toBe(1);
  });

  it('disappears as soon as a bid meets the reserve', async () => {
    await seedReserveBuyNow();
    await service.placeBid({
      productUuid,
      bidderId: bidderIds[0],
      maxBid: 6_000_000,
    });

    const snapshot = await service.publicSnapshot(productUuid);
    expect(snapshot.reserveMet).toBe(true);
    expect(snapshot.buyNowAvailable).toBe(false);

    await expect(
      service.buyNow({ productUuid, buyerId: bidderIds[1] }),
    ).rejects.toMatchObject({ code: 'BUY_NOW_UNAVAILABLE' });
  });

  it('still disappears on the first bid when there is no reserve', async () => {
    await seedAuction({ buyNowPrice: 3_000_000 });
    await service.placeBid({
      productUuid,
      bidderId: bidderIds[0],
      maxBid: 1_500_000,
    });

    const snapshot = await service.publicSnapshot(productUuid);
    expect(snapshot.buyNowAvailable).toBe(false);
    await expect(
      service.buyNow({ productUuid, buyerId: bidderIds[1] }),
    ).rejects.toMatchObject({ code: 'BUY_NOW_UNAVAILABLE' });
  });

  it('refuses a buy-out priced at or below the standing bid', async () => {
    // Only reachable now that bids can stand under an unmet reserve: a buy-now
    // price beneath the live bid would sell the item for less than someone bid.
    await seedAuction({
      reservePrice: 9_000_000,
      reserveMet: false,
      buyNowPrice: 3_000_000,
    });
    // Two bidders: a lone first bid only ever displays at the start price, so it
    // takes a challenger to drive the displayed price past the buy-now price.
    await service.placeBid({
      productUuid,
      bidderId: bidderIds[0],
      maxBid: 4_000_000,
    });
    await service.placeBid({
      productUuid,
      bidderId: bidderIds[1],
      maxBid: 3_500_000,
    });

    const snapshot = await service.publicSnapshot(productUuid);
    expect(snapshot.currentBid).toBeGreaterThan(3_000_000);
    expect(snapshot.reserveMet).toBe(false);
    expect(snapshot.buyNowAvailable).toBe(false);
    await expect(
      service.buyNow({ productUuid, buyerId: bidderIds[2] }),
    ).rejects.toMatchObject({ code: 'BUY_NOW_UNAVAILABLE' });
  });

  it('notifies whoever actually held the lead when a bid lands beside the buy out', async () => {
    // The prior leader comes from the claim's own before-image, so a bid landing
    // in the same instant can never redirect the notice to a bidder who did not
    // hold the lead — whoever is told is whoever the claim displaced.
    await seedReserveBuyNow();
    const [buyer, first, second] = bidderIds;
    await service.placeBid({ productUuid, bidderId: first, maxBid: 2_000_000 });
    await Promise.allSettled([
      service.buyNow({ productUuid, buyerId: buyer }),
      service.placeBid({ productUuid, bidderId: second, maxBid: 3_000_000 }),
    ]);

    const notices = await models.Notification.find({
      eventType: 'AUCTION_BOUGHT_OUT',
    }).lean();
    const product = await models.Product.findById(productId).lean();
    if (product.auction.status !== 'CLOSED') {
      // The buy out lost the race outright — nobody was displaced by it.
      expect(notices.length).toBe(0);
      return;
    }
    expect(notices.length).toBe(1);
    // Exactly one bidder held the lead at claim time; whichever it was, the
    // notice went to a real bidder and never to the buyer.
    expect([String(first), String(second)]).toContain(
      String(notices[0].userId),
    );
  });

  it('lets exactly one win when a reserve-meeting bid races the buy out', async () => {
    await seedReserveBuyNow();
    const [buyer, bidder] = bidderIds;
    const [buyRes, bidRes] = await Promise.allSettled([
      service.buyNow({ productUuid, buyerId: buyer }),
      service.placeBid({ productUuid, bidderId: bidder, maxBid: 6_000_000 }),
    ]);

    const product = await models.Product.findById(productId).lean();
    if (buyRes.status === 'fulfilled') {
      expect(product.auction.status).toBe('CLOSED');
      expect(String(product.auction.winnerId)).toBe(String(buyer));
      expect(product.auction.finalPrice).toBe(8_000_000);
      expect(bidRes.status).toBe('rejected');
    } else {
      // The bid met the reserve first, which retires Buy It Now.
      expect(bidRes.status).toBe('fulfilled');
      expect(product.auction.status).toBe('OPEN');
      expect(product.auction.reserveMet).toBe(true);
    }
  });
});

describe('auction close', () => {
  it('is idempotent under a double/concurrent close — one winner, one order, one notification', async () => {
    await seedAuction({ endsAt: new Date(Date.now() - 1000) });
    const winner = bidderIds[0];
    // Give it a leader by bidding while (briefly) open, then force-expire.
    await models.Product.updateOne(
      { _id: productId },
      {
        $set: {
          'auction.currentBidderId': winner,
          'auction.leaderMaxBid': 4_000_000,
          'auction.currentBid': 2_000_000,
          'auction.bidCount': 1,
        },
      },
    );
    const [c1, c2] = await Promise.all([
      service.closeAuction(productId),
      service.closeAuction(productId),
    ]);
    // Exactly one call performed the close.
    expect([c1, c2].filter(Boolean).length).toBe(1);

    const product = await models.Product.findById(productId).lean();
    expect(product.auction.status).toBe('CLOSED');
    expect(String(product.auction.winnerId)).toBe(String(winner));
    expect(product.auction.finalPrice).toBe(2_000_000);

    const orders = await models.Order.find({ buyerId: winner }).lean();
    expect(orders.length).toBe(1);
    expect(orders[0].orderStatus).toBe('PENDING_PAYMENT');
    const won = await models.Notification.find({
      eventType: 'AUCTION_WON',
    }).lean();
    expect(won.length).toBe(1);
  });

  it('closes with no winner when the reserve was never met', async () => {
    await seedAuction({
      reservePrice: 5_000_000,
      reserveMet: false,
      endsAt: new Date(Date.now() - 1000),
      currentBidderId: bidderIds[0],
      leaderMaxBid: 3_000_000,
      currentBid: 2_000_000,
      bidCount: 1,
    });
    const closed = await service.closeAuction(productId);
    expect(closed).not.toBeNull();
    const product = await models.Product.findById(productId).lean();
    expect(product.auction.status).toBe('CLOSED');
    expect(product.auction.winnerId).toBeUndefined();
    const orders = await models.Order.find({}).lean();
    expect(orders.length).toBe(0);
  });
});

describe('reserve jump end-to-end', () => {
  it('stays not-met below the reserve, then jumps to the reserve when a max clears it', async () => {
    await seedAuction({
      startPrice: 2_000_000,
      currentBid: 2_000_000,
      reservePrice: 5_000_000,
      reserveMet: false,
    });
    const [a, b] = bidderIds;
    await service.placeBid({ productUuid, bidderId: a, maxBid: 3_000_000 });
    let product = await models.Product.findById(productId).lean();
    expect(product.auction.reserveMet).toBe(false);
    expect(product.auction.currentBid).toBe(2_000_000);

    const r = await service.placeBid({
      productUuid,
      bidderId: b,
      maxBid: 6_000_000,
    });
    expect(r.currentBid).toBe(5_000_000);
    product = await models.Product.findById(productId).lean();
    expect(product.auction.reserveMet).toBe(true);
    expect(product.auction.currentBid).toBe(5_000_000);
    expect(String(product.auction.currentBidderId)).toBe(String(b));
  });
});

describe('auction items are not cart-purchasable', () => {
  // Guards the trust boundary: an AUCTION product must never be buyable through
  // the normal cart/checkout (that would bypass bidding, the reserve, and stock).
  const fixedId = new mongoose.Types.ObjectId('770000000000000000000020');
  const fixedUuid = '77000000-0000-4000-8000-000000000020';
  const userId = new mongoose.Types.ObjectId('770000000000000000000030');

  const seedSellerAndCategory = () =>
    Promise.all([
      models.SellerProfile.create({
        _id: sellerId,
        userId: new mongoose.Types.ObjectId('770000000000000000000031'),
        displayName: 'Guard Seller',
        status: 'ACTIVE',
      }),
      models.Category.create({
        _id: categoryId,
        name: 'Guard Category',
        slug: 'guard-category',
        status: 'ACTIVE',
      }),
    ]);

  it('rejects adding an auction to the cart, but allows a fixed product with the same seller/category', async () => {
    await seedSellerAndCategory();
    await seedAuction();
    await models.Product.create({
      _id: fixedId,
      uuid: fixedUuid,
      sellerId,
      categoryId,
      title: 'Fixed Control',
      description: 'A normal fixed-price product',
      price: 500_000,
      stock: 5,
      status: 'ACTIVE',
      listingType: 'FIXED',
      images: ['https://example.test/f.jpg'],
    });

    // The auction (active seller + category → would be buyerVisible if not for
    // listingType) is rejected as unavailable.
    await expect(
      cartService.add(userId, { productId: productUuid, quantity: 1 }),
    ).rejects.toMatchObject({ code: 'PRODUCT_UNAVAILABLE' });

    // The fixed product with the same seller/category adds fine — proving the
    // rejection is the auction guard, not a missing seller/category.
    const cart = await cartService.add(userId, {
      productId: fixedUuid,
      quantity: 1,
    });
    expect(cart.items.map((i) => i.productId)).toContain(fixedUuid);
  });
});
