import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { hashPassword } from '../common/utils/hash.js';
import { User } from '../modules/users/user.model.js';
import { Category } from '../modules/categories/category.model.js';
import { SellerProfile } from '../modules/sellers/seller-profile.model.js';
import { Product } from '../modules/products/product.model.js';
import { Bid } from '../modules/auctions/bid.model.js';
import { Offer } from '../modules/offers/offer.model.js';
import { Order } from '../modules/orders/order.model.js';
import { ProductReview } from '../modules/product-reviews/product-review.model.js';
import { SellerFeedback } from '../modules/seller-feedbacks/seller-feedback.model.js';
import { Coupon } from '../modules/coupons/coupon.model.js';
import { CheckoutGroup } from '../modules/checkout-groups/checkout-group.model.js';
import { Payment } from '../modules/payments/payment.model.js';
import { Refund } from '../modules/payments/refunds/refund.model.js';
import { ReturnRequest } from '../modules/returns/return-request.model.js';
import { seedCarriers } from '../modules/carriers/carrier.seed.js';

const FIXTURE_NOW = new Date('2030-01-15T12:00:00.000Z');
const FIXTURE_START = new Date('2020-01-01T00:00:00.000Z');
const FIXTURE_EXPIRY = new Date('2099-12-31T23:59:59.000Z');
const FIXTURE_EXPIRED_START = new Date('2020-01-01T00:00:00.000Z');
const FIXTURE_EXPIRED_END = new Date('2021-01-01T00:00:00.000Z');
const withFixtureTimestamps = (fixture) => ({
  ...fixture,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
});

const ids = Object.freeze({
  sellerUserOne: new mongoose.Types.ObjectId('660000000000000000000001'),
  sellerUserTwo: new mongoose.Types.ObjectId('660000000000000000000002'),
  buyerUser: new mongoose.Types.ObjectId('660000000000000000000003'),
  sellerOne: new mongoose.Types.ObjectId('660000000000000000000011'),
  sellerTwo: new mongoose.Types.ObjectId('660000000000000000000012'),
  electronics: new mongoose.Types.ObjectId('660000000000000000000021'),
  fashion: new mongoose.Types.ObjectId('660000000000000000000022'),
  inactiveCategory: new mongoose.Types.ObjectId('660000000000000000000023'),
  smartphones: new mongoose.Types.ObjectId('660000000000000000000024'),
  laptopsCategory: new mongoose.Types.ObjectId('660000000000000000000025'),
  audio: new mongoose.Types.ObjectId('660000000000000000000026'),
  phoneAccessories: new mongoose.Types.ObjectId('660000000000000000000027'),
  ultrabooks: new mongoose.Types.ObjectId('660000000000000000000028'),
  gamingLaptops: new mongoose.Types.ObjectId('660000000000000000000029'),
  audioHeadphones: new mongoose.Types.ObjectId('66000000000000000000002a'),
  speakers: new mongoose.Types.ObjectId('66000000000000000000002b'),
  mensFashion: new mongoose.Types.ObjectId('66000000000000000000002c'),
  womensFashion: new mongoose.Types.ObjectId('66000000000000000000002d'),
  laptop: new mongoose.Types.ObjectId('660000000000000000000031'),
  shoes: new mongoose.Types.ObjectId('660000000000000000000032'),
  headphones: new mongoose.Types.ObjectId('660000000000000000000033'),
  hiddenProduct: new mongoose.Types.ObjectId('660000000000000000000034'),
  auctionQuick: new mongoose.Types.ObjectId('660000000000000000000035'),
  auctionReserve: new mongoose.Types.ObjectId('660000000000000000000036'),
  auctionNoReserve: new mongoose.Types.ObjectId('660000000000000000000037'),
  auctionBuyNow: new mongoose.Types.ObjectId('660000000000000000000038'),
  auctionReserveBuyNow: new mongoose.Types.ObjectId('66000000000000000000003b'),
  offerProductOne: new mongoose.Types.ObjectId('660000000000000000000039'),
  offerProductTwo: new mongoose.Types.ObjectId('66000000000000000000003a'),
  // Stable public product uuids so dev URLs stay constant across reseeds.
  laptopUuid: '00000000-0000-4000-8000-000000000031',
  shoesUuid: '00000000-0000-4000-8000-000000000032',
  headphonesUuid: '00000000-0000-4000-8000-000000000033',
  hiddenProductUuid: '00000000-0000-4000-8000-000000000034',
  auctionQuickUuid: '00000000-0000-4000-8000-000000000035',
  auctionReserveUuid: '00000000-0000-4000-8000-000000000036',
  auctionNoReserveUuid: '00000000-0000-4000-8000-000000000037',
  auctionBuyNowUuid: '00000000-0000-4000-8000-000000000038',
  auctionReserveBuyNowUuid: '00000000-0000-4000-8000-00000000003b',
  offerProductOneUuid: '00000000-0000-4000-8000-000000000039',
  offerProductTwoUuid: '00000000-0000-4000-8000-00000000003a',
  order: new mongoose.Types.ObjectId('660000000000000000000041'),
  orderItem: new mongoose.Types.ObjectId('660000000000000000000051'),
  percentageCoupon: new mongoose.Types.ObjectId('660000000000000000000061'),
  fixedCoupon: new mongoose.Types.ObjectId('660000000000000000000062'),
  expiredCoupon: new mongoose.Types.ObjectId('660000000000000000000063'),
  inactiveCoupon: new mongoose.Types.ObjectId('660000000000000000000064'),
  minimumCoupon: new mongoose.Types.ObjectId('660000000000000000000065'),
  cappedCoupon: new mongoose.Types.ObjectId('660000000000000000000066'),
  limitedCoupon: new mongoose.Types.ObjectId('660000000000000000000067'),
  checkoutGroup: new mongoose.Types.ObjectId('660000000000000000000071'),
  payment: new mongoose.Types.ObjectId('660000000000000000000072'),
  returnRequest: new mongoose.Types.ObjectId('660000000000000000000073'),
});

const seededProductId = (index) =>
  new mongoose.Types.ObjectId(
    `6700000000000000000000${String(index).padStart(2, '0')}`,
  );
const additionalProductIds = Array.from({ length: 30 }, (_, index) =>
  seededProductId(index + 1),
);
const unsplash = (photoId) =>
  `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1200&q=80`;

const additionalProducts = [
  {
    title: 'Nova X Pro Smartphone',
    description: 'Flagship 5G smartphone with OLED display and triple camera',
    categoryId: ids.smartphones,
    sellerId: ids.sellerOne,
    price: 21990000,
    stock: 15,
    image: unsplash('photo-1511707171634-5f897ff02aa9'),
    averageRating: 4.8,
    reviewCount: 124,
  },
  {
    title: 'Lite 5G Smartphone',
    description: 'Affordable 5G phone with long battery life',
    categoryId: ids.smartphones,
    sellerId: ids.sellerOne,
    price: 7490000,
    stock: 32,
    image: unsplash('photo-1598327105666-5b89351aff97'),
    averageRating: 4.2,
    reviewCount: 57,
  },
  {
    title: 'Compact Android Phone',
    description: 'Compact daily smartphone with dual SIM support',
    categoryId: ids.smartphones,
    sellerId: ids.sellerOne,
    price: 4290000,
    stock: 0,
    status: 'OUT_OF_STOCK',
    image: unsplash('photo-1601784551446-20c9e07cdbdb'),
    averageRating: 3.9,
    reviewCount: 18,
  },
  {
    title: 'Clear Protective Phone Case',
    description: 'Shock-resistant transparent case for modern smartphones',
    categoryId: ids.phoneAccessories,
    sellerId: ids.sellerOne,
    price: 249000,
    stock: 80,
    image: unsplash('photo-1601593346740-925612772716'),
    averageRating: 4.1,
    reviewCount: 203,
  },
  {
    title: 'Magnetic Wireless Charger',
    description: 'Fast magnetic charging pad with USB-C cable',
    categoryId: ids.phoneAccessories,
    sellerId: ids.sellerOne,
    price: 690000,
    stock: 45,
    image: unsplash('photo-1622434641406-a158123450f9'),
    averageRating: 4.5,
    reviewCount: 88,
  },
  {
    title: 'Braided USB-C Cable',
    description: 'Durable two-meter charging and data cable',
    categoryId: ids.phoneAccessories,
    sellerId: ids.sellerOne,
    price: 159000,
    stock: 0,
    status: 'OUT_OF_STOCK',
    image: unsplash('photo-1615526675159-e248c3021d3f'),
    averageRating: 3.7,
    reviewCount: 41,
  },
  {
    title: 'Air Slim Ultrabook 13',
    description: 'Lightweight aluminum laptop for mobile professionals',
    categoryId: ids.ultrabooks,
    sellerId: ids.sellerOne,
    price: 28990000,
    stock: 9,
    image: unsplash('photo-1496181133206-80ce9b88a853'),
    averageRating: 4.9,
    reviewCount: 76,
  },
  {
    title: 'Business Ultrabook 14',
    description: 'Secure business laptop with all-day battery',
    categoryId: ids.ultrabooks,
    sellerId: ids.sellerOne,
    price: 23490000,
    stock: 6,
    image: unsplash('photo-1517336714731-489689fd1ca8'),
    averageRating: 4.6,
    reviewCount: 34,
  },
  {
    title: 'Creator OLED Ultrabook',
    description: 'Color-accurate OLED laptop for creative work',
    categoryId: ids.ultrabooks,
    sellerId: ids.sellerOne,
    price: 32990000,
    stock: 4,
    image: unsplash('photo-1525547719571-a2d4ac8945e2'),
    averageRating: 4.7,
    reviewCount: 29,
  },
  {
    title: 'Phantom RTX Gaming Laptop',
    description: 'High-refresh gaming laptop with dedicated graphics',
    categoryId: ids.gamingLaptops,
    sellerId: ids.sellerOne,
    price: 39990000,
    stock: 7,
    image: unsplash('photo-1603302576837-37561b2e2302'),
    averageRating: 4.8,
    reviewCount: 61,
  },
  {
    title: 'Entry Gaming Laptop 15',
    description: 'Affordable gaming notebook with RGB keyboard',
    categoryId: ids.gamingLaptops,
    sellerId: ids.sellerOne,
    price: 18990000,
    stock: 11,
    image: unsplash('photo-1593642632823-8f785ba67e45'),
    averageRating: 4.0,
    reviewCount: 45,
  },
  {
    title: 'Titan Gaming Laptop 17',
    description: 'Desktop-class performance in a large gaming notebook',
    categoryId: ids.gamingLaptops,
    sellerId: ids.sellerOne,
    price: 54990000,
    stock: 0,
    status: 'OUT_OF_STOCK',
    image: unsplash('photo-1593640408182-31c70c8268f5'),
    averageRating: 4.9,
    reviewCount: 17,
  },
  {
    title: 'Studio Wireless Headphones',
    description: 'Over-ear wireless headphones with active noise cancellation',
    categoryId: ids.audioHeadphones,
    sellerId: ids.sellerOne,
    price: 4590000,
    stock: 20,
    image: unsplash('photo-1505740420928-5e560c06d30e'),
    averageRating: 4.7,
    reviewCount: 312,
  },
  {
    title: 'Sport Bluetooth Earbuds',
    description: 'Water-resistant true wireless earbuds for exercise',
    categoryId: ids.audioHeadphones,
    sellerId: ids.sellerOne,
    price: 1790000,
    stock: 37,
    image: unsplash('photo-1606220945770-b5b6c2c55bf1'),
    averageRating: 4.3,
    reviewCount: 146,
  },
  {
    title: 'Wired Monitoring Headphones',
    description: 'Closed-back studio headphones with neutral sound',
    categoryId: ids.audioHeadphones,
    sellerId: ids.sellerOne,
    price: 2390000,
    stock: 13,
    image: unsplash('photo-1484704849700-f032a568e944'),
    averageRating: 4.4,
    reviewCount: 69,
  },
  {
    title: 'Pocket Bluetooth Speaker',
    description: 'Compact portable speaker for travel and outdoor use',
    categoryId: ids.speakers,
    sellerId: ids.sellerOne,
    price: 890000,
    stock: 28,
    image: unsplash('photo-1608043152269-423dbba4e7e1'),
    averageRating: 4.2,
    reviewCount: 98,
  },
  {
    title: 'Home Smart Speaker',
    description: 'Voice-enabled smart speaker for connected homes',
    categoryId: ids.speakers,
    sellerId: ids.sellerOne,
    price: 2490000,
    stock: 16,
    image: unsplash('photo-1543512214-318c7553f230'),
    averageRating: 4.6,
    reviewCount: 115,
  },
  {
    title: 'Premium Bookshelf Speakers',
    description: 'Stereo bookshelf speaker pair with detailed sound',
    categoryId: ids.speakers,
    sellerId: ids.sellerOne,
    price: 6990000,
    stock: 5,
    image: unsplash('photo-1558537348-c0f8e733989d'),
    averageRating: 4.8,
    reviewCount: 22,
  },
  {
    title: 'Classic Denim Jacket',
    description: 'Regular-fit blue denim jacket for everyday wear',
    categoryId: ids.mensFashion,
    sellerId: ids.sellerTwo,
    price: 1290000,
    stock: 24,
    image: unsplash('photo-1551028719-00167b16eac5'),
    averageRating: 4.4,
    reviewCount: 83,
  },
  {
    title: 'Essential Cotton T-Shirt',
    description: 'Soft breathable cotton crew-neck shirt',
    categoryId: ids.mensFashion,
    sellerId: ids.sellerTwo,
    price: 349000,
    stock: 65,
    image: unsplash('photo-1521572163474-6864f9cf17ab'),
    averageRating: 4.1,
    reviewCount: 190,
  },
  {
    title: 'Leather Oxford Shoes',
    description: 'Formal leather lace-up shoes for business occasions',
    categoryId: ids.mensFashion,
    sellerId: ids.sellerTwo,
    price: 2190000,
    stock: 10,
    image: unsplash('photo-1614252369475-531eba835eb1'),
    averageRating: 4.5,
    reviewCount: 47,
  },
  {
    title: 'Minimalist Steel Watch',
    description: 'Clean analog wristwatch with stainless steel case',
    categoryId: ids.mensFashion,
    sellerId: ids.sellerTwo,
    price: 3190000,
    stock: 8,
    image: unsplash('photo-1523275335684-37898b6baf30'),
    averageRating: 4.7,
    reviewCount: 71,
  },
  {
    title: 'Urban Running Sneakers',
    description: 'Lightweight cushioned sneakers for daily training',
    categoryId: ids.mensFashion,
    sellerId: ids.sellerTwo,
    price: 1890000,
    stock: 0,
    status: 'OUT_OF_STOCK',
    image: unsplash('photo-1549298916-b41d501d3772'),
    averageRating: 4.6,
    reviewCount: 137,
  },
  {
    title: 'Floral Summer Dress',
    description: 'Lightweight floral dress for warm-weather occasions',
    categoryId: ids.womensFashion,
    sellerId: ids.sellerTwo,
    price: 1490000,
    stock: 19,
    image: unsplash('photo-1595777457583-95e059d581b8'),
    averageRating: 4.8,
    reviewCount: 104,
  },
  {
    title: 'Structured Leather Handbag',
    description: 'Medium leather handbag with detachable shoulder strap',
    categoryId: ids.womensFashion,
    sellerId: ids.sellerTwo,
    price: 2790000,
    stock: 14,
    image: unsplash('photo-1584917865442-de89df76afd3'),
    averageRating: 4.7,
    reviewCount: 91,
  },
  {
    title: 'Cat-Eye Sunglasses',
    description: 'UV-protection sunglasses with a classic cat-eye frame',
    categoryId: ids.womensFashion,
    sellerId: ids.sellerTwo,
    price: 590000,
    stock: 42,
    image: unsplash('photo-1511499767150-a48a237f0083'),
    averageRating: 4.0,
    reviewCount: 58,
  },
  {
    title: 'Classic High Heel Pumps',
    description: 'Elegant high heel shoes with a pointed toe',
    categoryId: ids.womensFashion,
    sellerId: ids.sellerTwo,
    price: 1690000,
    stock: 17,
    image: unsplash('photo-1543163521-1bf539c55dd2'),
    averageRating: 4.3,
    reviewCount: 39,
  },
  {
    title: 'Wide Brim Summer Hat',
    description: 'Lightweight sun hat with a wide protective brim',
    categoryId: ids.womensFashion,
    sellerId: ids.sellerTwo,
    price: 459000,
    stock: 31,
    image: unsplash('photo-1521369909029-2afed882baee'),
    averageRating: 3.8,
    reviewCount: 27,
  },
  {
    title: 'Silk Pattern Scarf',
    description: 'Soft patterned scarf for casual and formal styling',
    categoryId: ids.womensFashion,
    sellerId: ids.sellerTwo,
    price: 790000,
    stock: 23,
    image: unsplash('photo-1601924994987-69e26d50dc26'),
    averageRating: 4.4,
    reviewCount: 52,
  },
  {
    title: 'Everyday Canvas Tote Bag',
    description: 'Reusable canvas tote with reinforced handles',
    categoryId: ids.womensFashion,
    sellerId: ids.sellerTwo,
    price: 299000,
    stock: 50,
    image: unsplash('photo-1594223274512-ad4803739b7c'),
    averageRating: 3.9,
    reviewCount: 66,
  },
].map((product, index) => ({
  _id: additionalProductIds[index],
  ...product,
  images: [product.image],
  attributes: [],
  status: product.status || 'ACTIVE',
}));

// Auction + offers-enabled fixtures. Auctions use REAL-clock end times (not the
// frozen FIXTURE_NOW) so the live countdown and close/sweep actually fire during
// a demo. `reserveMet` starts true when there is no reserve (the auction can
// always produce a winner) and false when a reserve floor exists.
//
// Every listing spells out its hidden knobs — reserve price, Buy It Now price,
// start price, close time — on a `[DEMO]` line in the description. A shopper
// can't see those on the storefront, so this lets the presenter know exactly
// what to bid to trip the reserve badge or grab Buy It Now during a live demo.
const vnd = (amount) => `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
// Fresh id/uuid space (6a… ObjectIds, …0a… uuids) for the generated batches so
// they never collide with the named fixtures; all are registered for cleanup.
const demoId = (n) =>
  new mongoose.Types.ObjectId(
    `6a00000000000000000000${String(n).padStart(2, '0')}`,
  );
const demoUuid = (n) =>
  `00000000-0000-4000-8000-0000000a00${String(n).padStart(2, '0')}`;
// Rotating pool of real Unsplash photo ids (all resolve) for visual variety.
const demoPhotos = [
  'photo-1516035069371-29a1b244cc32',
  'photo-1587829741301-dc798b83add3',
  'photo-1548036328-c9fa89d128fa',
  'photo-1590658268037-6bf12165a8df',
  'photo-1505740420928-5e560c06d30e',
  'photo-1606220945770-b5b6c2c55bf1',
  'photo-1608043152269-423dbba4e7e1',
  'photo-1523275335684-37898b6baf30',
  'photo-1614252369475-531eba835eb1',
  'photo-1558537348-c0f8e733989d',
];

const buildAuctionAndOfferProducts = (now) => {
  const inMinutes = (m) => new Date(now.getTime() + m * 60_000);
  const inHours = (h) => new Date(now.getTime() + h * 3_600_000);
  const inDays = (d) => new Date(now.getTime() + d * 24 * 3_600_000);

  // Storefront blurb + a [DEMO] cheat-line exposing the hidden knobs.
  const auctionDoc = (spec) => {
    const { startPrice, reservePrice, buyNowPrice, blurb, endLabel } = spec;
    const cheat = [
      `Start ${vnd(startPrice)}`,
      reservePrice
        ? `Reserve ${vnd(reservePrice)} — đặt max ≥ mức này để chuyển "Reserve met"`
        : 'Không có reserve',
      buyNowPrice
        ? `Buy It Now ${vnd(buyNowPrice)} — ${
            reservePrice
              ? 'còn đến khi có bid đạt reserve'
              : 'chỉ còn khi chưa có bid'
          }`
        : null,
      `Kết thúc: ${endLabel}`,
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      _id: spec._id,
      uuid: spec.uuid,
      sellerId: spec.sellerId,
      categoryId: spec.categoryId,
      title: spec.title,
      description: `${blurb}\n\n[DEMO] ${cheat}`,
      price: startPrice,
      stock: 1,
      status: 'ACTIVE',
      attributes: [],
      listingType: 'AUCTION',
      images: [unsplash(spec.photoId)],
      auction: {
        startPrice,
        currentBid: startPrice,
        bidCount: 0,
        version: 0,
        status: 'OPEN',
        reserveMet: !reservePrice,
        startsAt: now,
        endsAt: spec.endsAt,
        ...(reservePrice && { reservePrice }),
        ...(buyNowPrice && { buyNowPrice }),
      },
    };
  };

  const offerDoc = (spec) => ({
    _id: spec._id,
    uuid: spec.uuid,
    sellerId: spec.sellerId,
    categoryId: spec.categoryId,
    title: spec.title,
    description: `${spec.blurb}\n\n[DEMO] List ${vnd(spec.price)} · Gợi ý: seller sẽ chấp nhận offer ≥ ${vnd(spec.acceptFrom)}`,
    price: spec.price,
    stock: spec.stock ?? 10,
    status: 'ACTIVE',
    attributes: [],
    listingType: 'FIXED',
    offersEnabled: true,
    images: [unsplash(spec.photoId)],
  });

  // Named demo auctions (stable uuids so bookmarked dev URLs keep working).
  const namedAuctions = [
    auctionDoc({
      _id: ids.auctionQuick,
      uuid: ids.auctionQuickUuid,
      sellerId: ids.sellerOne,
      categoryId: ids.electronics,
      title: 'Auction — Vintage Film Camera (đóng sau ~3 phút)',
      blurb: 'Đấu giá demo ngắn: đặt proxy max bid rồi xem nó tự đóng.',
      startPrice: 1_000_000,
      endsAt: inMinutes(3),
      endLabel: '~3 phút nữa',
      photoId: 'photo-1516035069371-29a1b244cc32',
    }),
    auctionDoc({
      _id: ids.auctionReserve,
      uuid: ids.auctionReserveUuid,
      sellerId: ids.sellerOne,
      categoryId: ids.electronics,
      title: 'Auction — Mechanical Keyboard (có reserve)',
      blurb:
        'Đấu giá có giá sàn ẩn: max dưới reserve hiện "Reserve not met", max ≥ reserve sẽ đẩy giá lên mức reserve.',
      startPrice: 2_000_000,
      reservePrice: 5_000_000,
      endsAt: inDays(2),
      endLabel: '~2 ngày nữa',
      photoId: 'photo-1587829741301-dc798b83add3',
    }),
    auctionDoc({
      _id: ids.auctionNoReserve,
      uuid: ids.auctionNoReserveUuid,
      sellerId: ids.sellerTwo,
      categoryId: ids.fashion,
      title: 'Auction — Leather Messenger Bag (no reserve)',
      blurb: 'Không reserve: proxy max cao nhất lúc đóng sẽ thắng.',
      startPrice: 500_000,
      endsAt: inDays(1),
      endLabel: '~1 ngày nữa',
      photoId: 'photo-1548036328-c9fa89d128fa',
    }),
    auctionDoc({
      _id: ids.auctionBuyNow,
      uuid: ids.auctionBuyNowUuid,
      sellerId: ids.sellerOne,
      categoryId: ids.electronics,
      title: 'Auction — Wireless Earbuds (Buy It Now)',
      blurb: 'Buy It Now chỉ còn khi chưa có bid; bid đầu tiên sẽ gỡ nó.',
      startPrice: 1_000_000,
      buyNowPrice: 3_000_000,
      endsAt: inDays(1),
      endLabel: '~1 ngày nữa',
      photoId: 'photo-1590658268037-6bf12165a8df',
    }),
    auctionDoc({
      _id: ids.auctionReserveBuyNow,
      uuid: ids.auctionReserveBuyNowUuid,
      sellerId: ids.sellerTwo,
      categoryId: ids.electronics,
      title: 'Auction — Vintage Film Camera (reserve + Buy It Now)',
      blurb:
        'Buy It Now vẫn còn sau bid đầu tiên vì chưa ai đạt reserve; bid đạt reserve sẽ gỡ nó.',
      startPrice: 2_000_000,
      reservePrice: 6_000_000,
      buyNowPrice: 8_000_000,
      endsAt: inDays(2),
      endLabel: '~2 ngày nữa',
      photoId: 'photo-1484704849700-f032a568e944',
    }),
  ];

  // Buy-It-Now stock for repeated demos — each purchase (or first bid) consumes
  // one auction's Buy It Now, so seed a generous batch. All close 24h from seed
  // time, no reserve so the Buy It Now path stays clean.
  const buyNowItems = [
    { name: 'Studio Headphones', start: 800_000 },
    { name: 'Sport Earbuds', start: 600_000 },
    { name: 'Portable Speaker', start: 500_000 },
    { name: 'Minimalist Watch', start: 1_200_000 },
    { name: 'Leather Oxford Shoes', start: 900_000 },
    { name: 'Bookshelf Speakers', start: 2_000_000 },
    { name: 'Vintage Film Camera', start: 1_500_000 },
    { name: 'Mechanical Keyboard', start: 1_000_000 },
    { name: 'Messenger Bag', start: 700_000 },
    { name: 'Wireless Earbuds', start: 650_000 },
    { name: 'Smartwatch', start: 1_100_000 },
    { name: 'Noise-Cancelling Headphones', start: 1_300_000 },
  ];
  const buyNowAuctions = buyNowItems.map((item, i) => {
    const n = i + 1; // 01..12
    return auctionDoc({
      _id: demoId(n),
      uuid: demoUuid(n),
      sellerId: i % 2 === 0 ? ids.sellerOne : ids.sellerTwo,
      categoryId: i % 2 === 0 ? ids.electronics : ids.fashion,
      title: `Auction Buy-Now #${n} — ${item.name}`,
      blurb: `Món Buy It Now để test lặp lại (#${n}). Bấm mua ngay, hoặc đặt bid để gỡ Buy It Now.`,
      startPrice: item.start,
      buyNowPrice: item.start * 3,
      endsAt: inDays(1),
      endLabel: '24h nữa',
      photoId: demoPhotos[i % demoPhotos.length],
    });
  });

  // Extra reserve auctions to exercise the Reserve met / not-met badge.
  const reserveSpecs = [
    {
      name: 'Vintage Watch',
      start: 3_000_000,
      reserve: 10_000_000,
      ends: inDays(3),
      label: '~3 ngày nữa',
      cat: ids.electronics,
      seller: ids.sellerOne,
    },
    {
      name: 'Bookshelf Speakers',
      start: 4_000_000,
      reserve: 9_000_000,
      ends: inDays(5),
      label: '~5 ngày nữa',
      cat: ids.electronics,
      seller: ids.sellerOne,
    },
    {
      name: 'Designer Handbag',
      start: 1_000_000,
      reserve: 3_000_000,
      ends: inHours(12),
      label: '~12 giờ nữa',
      cat: ids.fashion,
      seller: ids.sellerTwo,
    },
    {
      name: 'Denim Jacket',
      start: 400_000,
      reserve: 900_000,
      ends: inHours(6),
      label: '~6 giờ nữa',
      cat: ids.fashion,
      seller: ids.sellerTwo,
    },
  ];
  const reserveAuctions = reserveSpecs.map((spec, i) => {
    const n = 20 + i + 1; // 21..24
    return auctionDoc({
      _id: demoId(n),
      uuid: demoUuid(n),
      sellerId: spec.seller,
      categoryId: spec.cat,
      title: `Auction — ${spec.name} (reserve)`,
      blurb: 'Đấu giá có giá sàn ẩn để test badge Reserve met / not met.',
      startPrice: spec.start,
      reservePrice: spec.reserve,
      endsAt: spec.ends,
      endLabel: spec.label,
      photoId: demoPhotos[(i + 5) % demoPhotos.length],
    });
  });

  // Offer-able (Best Offer) fixtures.
  const namedOffers = [
    offerDoc({
      _id: ids.offerProductOne,
      uuid: ids.offerProductOneUuid,
      sellerId: ids.sellerOne,
      categoryId: ids.electronics,
      title: 'Smart Home Hub (accepts offers)',
      blurb: 'Listing giá cố định, nhận Best Offer từ người mua.',
      price: 3_500_000,
      acceptFrom: 3_000_000,
      stock: 10,
      photoId: 'photo-1558089687-f282ffcbc126',
    }),
    offerDoc({
      _id: ids.offerProductTwo,
      uuid: ids.offerProductTwoUuid,
      sellerId: ids.sellerTwo,
      categoryId: ids.fashion,
      title: 'Designer Sunglasses (accepts offers)',
      blurb: 'Listing thời trang giá cố định, mở nhận Best Offer.',
      price: 890_000,
      acceptFrom: 700_000,
      stock: 25,
      photoId: 'photo-1572635196237-14b3f281503f',
    }),
  ];
  const extraOfferSpecs = [
    {
      name: 'Sport Bluetooth Earbuds',
      price: 1_790_000,
      accept: 1_400_000,
      cat: ids.electronics,
      seller: ids.sellerOne,
      photo: 'photo-1606220945770-b5b6c2c55bf1',
    },
    {
      name: 'Cat-Eye Sunglasses',
      price: 590_000,
      accept: 450_000,
      cat: ids.fashion,
      seller: ids.sellerTwo,
      photo: 'photo-1511499767150-a48a237f0083',
    },
    {
      name: 'Classic High Heel Pumps',
      price: 1_690_000,
      accept: 1_300_000,
      cat: ids.fashion,
      seller: ids.sellerTwo,
      photo: 'photo-1543163521-1bf539c55dd2',
    },
    {
      name: 'Everyday Canvas Tote',
      price: 299_000,
      accept: 220_000,
      cat: ids.fashion,
      seller: ids.sellerTwo,
      photo: 'photo-1594223274512-ad4803739b7c',
    },
  ];
  const extraOffers = extraOfferSpecs.map((spec, i) => {
    const n = 40 + i + 1; // 41..44
    return offerDoc({
      _id: demoId(n),
      uuid: demoUuid(n),
      sellerId: spec.seller,
      categoryId: spec.cat,
      title: `${spec.name} (accepts offers)`,
      blurb: 'Listing giá cố định mở nhận Best Offer.',
      price: spec.price,
      acceptFrom: spec.accept,
      stock: 20,
      photoId: spec.photo,
    });
  });

  return [
    ...namedAuctions,
    ...buyNowAuctions,
    ...reserveAuctions,
    ...namedOffers,
    ...extraOffers,
  ];
};

const reviewComments = [
  'Excellent quality and exactly as described.',
  'Good value for the price.',
  'Works well, but the packaging could be better.',
  'Fast delivery and solid build quality.',
  'Average experience; it meets the basic requirements.',
  'Very satisfied after using it for several weeks.',
  'The product did not fully match my expectations.',
  'Easy to use and would recommend it.',
  'Premium finish and reliable performance.',
  'Useful product with a few minor drawbacks.',
];
const reviewGroups = [
  { productId: ids.laptop, ratings: [5, 4, 3, 5, 2, 4, 1, 5, 4, 3] },
  { productId: additionalProductIds[0], ratings: [5, 5, 4, 4] },
  { productId: additionalProductIds[12], ratings: [4, 5, 3] },
  { productId: additionalProductIds[23], ratings: [5, 4, 5] },
];
const productReviewFixtures = reviewGroups.flatMap((group, groupIndex) =>
  group.ratings.map((rating, itemIndex) => {
    const reviewIndex =
      reviewGroups
        .slice(0, groupIndex)
        .reduce((total, item) => total + item.ratings.length, 0) + itemIndex;
    const suffix = String(reviewIndex + 1).padStart(2, '0');
    const timestamp = new Date(
      Date.UTC(2030, 0, reviewIndex + 1, 8 + (reviewIndex % 10)),
    );
    return {
      _id: new mongoose.Types.ObjectId(`6800000000000000000000${suffix}`),
      productId: group.productId,
      buyerId: [ids.buyerUser, ids.sellerUserOne, ids.sellerUserTwo][
        reviewIndex % 3
      ],
      orderId: new mongoose.Types.ObjectId(`6810000000000000000000${suffix}`),
      orderItemId: new mongoose.Types.ObjectId(
        `6820000000000000000000${suffix}`,
      ),
      rating,
      comment: reviewComments[reviewIndex % reviewComments.length],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }),
);

const seed = async () => {
  await connectDatabase();
  await seedCarriers();
  const passwordHash = await hashPassword('BuyerDemo123!');
  const userIds = [ids.sellerUserOne, ids.sellerUserTwo, ids.buyerUser];
  const sellerIds = [ids.sellerOne, ids.sellerTwo];
  const categoryIds = [
    ids.electronics,
    ids.fashion,
    ids.inactiveCategory,
    ids.smartphones,
    ids.laptopsCategory,
    ids.audio,
    ids.phoneAccessories,
    ids.ultrabooks,
    ids.gamingLaptops,
    ids.audioHeadphones,
    ids.speakers,
    ids.mensFashion,
    ids.womensFashion,
  ];
  // Built once so the create call and the cleanup list share the same ids and
  // the same real-clock end times.
  const auctionAndOfferProducts = buildAuctionAndOfferProducts(new Date());
  const productIds = [
    ids.laptop,
    ids.shoes,
    ids.headphones,
    ids.hiddenProduct,
    ...additionalProductIds,
    ...auctionAndOfferProducts.map((product) => product._id),
  ];

  await Coupon.deleteMany({
    _id: {
      $in: [
        ids.percentageCoupon,
        ids.fixedCoupon,
        ids.expiredCoupon,
        ids.inactiveCoupon,
        ids.minimumCoupon,
        ids.cappedCoupon,
        ids.limitedCoupon,
      ],
    },
  });
  await ReturnRequest.deleteMany({ _id: ids.returnRequest });
  await Refund.deleteMany({ paymentId: ids.payment });
  await Payment.deleteMany({ _id: ids.payment });
  await CheckoutGroup.deleteMany({ _id: ids.checkoutGroup });
  await SellerFeedback.deleteMany({ sellerId: { $in: sellerIds } });
  await ProductReview.deleteMany({ productId: { $in: productIds } });
  await Order.deleteMany({ _id: ids.order });
  await Bid.deleteMany({ productId: { $in: productIds } });
  await Offer.deleteMany({ productId: { $in: productIds } });
  await Product.deleteMany({ _id: { $in: productIds } });
  await SellerProfile.deleteMany({ _id: { $in: sellerIds } });
  await Category.deleteMany({ _id: { $in: categoryIds } });
  await User.deleteMany({ _id: { $in: userIds } });

  await User.create([
    {
      _id: ids.sellerUserOne,
      email: 'seller.one@example.test',
      passwordHash,
      fullName: 'Demo Seller One',
      role: 'USER',
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: FIXTURE_NOW,
    },
    {
      _id: ids.sellerUserTwo,
      email: 'seller.two@example.test',
      passwordHash,
      fullName: 'Demo Seller Two',
      role: 'USER',
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: FIXTURE_NOW,
    },
    {
      _id: ids.buyerUser,
      email: 'buyer.demo@example.test',
      passwordHash,
      fullName: 'Demo Buyer',
      role: 'USER',
      status: 'ACTIVE',
      isEmailVerified: true,
      emailVerifiedAt: FIXTURE_NOW,
    },
  ]);

  await Category.create([
    {
      _id: ids.electronics,
      name: 'Electronics',
      slug: 'electronics',
      description: 'Development electronics catalog',
      status: 'ACTIVE',
    },
    {
      _id: ids.fashion,
      name: 'Fashion',
      slug: 'fashion',
      description: 'Development fashion catalog',
      status: 'ACTIVE',
    },
    {
      _id: ids.inactiveCategory,
      name: 'Archived',
      slug: 'archived',
      status: 'INACTIVE',
    },
    {
      _id: ids.smartphones,
      name: 'Smartphones',
      slug: 'smartphones',
      description: 'Mobile phones and smartphones',
      parentId: ids.electronics,
      status: 'ACTIVE',
    },
    {
      _id: ids.laptopsCategory,
      name: 'Laptops',
      slug: 'laptops',
      description: 'Portable computers for work and gaming',
      parentId: ids.electronics,
      status: 'ACTIVE',
    },
    {
      _id: ids.audio,
      name: 'Audio',
      slug: 'audio',
      description: 'Personal and home audio equipment',
      parentId: ids.electronics,
      status: 'ACTIVE',
    },
    {
      _id: ids.phoneAccessories,
      name: 'Phone Accessories',
      slug: 'phone-accessories',
      description: 'Cases, chargers and smartphone accessories',
      parentId: ids.smartphones,
      status: 'ACTIVE',
    },
    {
      _id: ids.ultrabooks,
      name: 'Ultrabooks',
      slug: 'ultrabooks',
      description: 'Thin and lightweight laptops',
      parentId: ids.laptopsCategory,
      status: 'ACTIVE',
    },
    {
      _id: ids.gamingLaptops,
      name: 'Gaming Laptops',
      slug: 'gaming-laptops',
      description: 'High-performance portable gaming computers',
      parentId: ids.laptopsCategory,
      status: 'ACTIVE',
    },
    {
      _id: ids.audioHeadphones,
      name: 'Headphones',
      slug: 'headphones',
      description: 'Wired and wireless headphones',
      parentId: ids.audio,
      status: 'ACTIVE',
    },
    {
      _id: ids.speakers,
      name: 'Speakers',
      slug: 'speakers',
      description: 'Portable and home speakers',
      parentId: ids.audio,
      status: 'ACTIVE',
    },
    {
      _id: ids.mensFashion,
      name: "Men's Fashion",
      slug: 'mens-fashion',
      description: "Men's clothing and accessories",
      parentId: ids.fashion,
      status: 'ACTIVE',
    },
    {
      _id: ids.womensFashion,
      name: "Women's Fashion",
      slug: 'womens-fashion',
      description: "Women's clothing and accessories",
      parentId: ids.fashion,
      status: 'ACTIVE',
    },
  ]);

  await SellerProfile.create([
    {
      _id: ids.sellerOne,
      userId: ids.sellerUserOne,
      displayName: 'Demo Tech Store',
      avatarUrl: 'https://example.test/images/seller-one.jpg',
      description: 'Fake development seller for electronics',
      status: 'ACTIVE',
    },
    {
      _id: ids.sellerTwo,
      userId: ids.sellerUserTwo,
      displayName: 'Demo Fashion Store',
      avatarUrl: 'https://example.test/images/seller-two.jpg',
      description: 'Fake development seller for fashion',
      status: 'ACTIVE',
    },
  ]);

  await Product.create([
    {
      _id: ids.laptop,
      uuid: ids.laptopUuid,
      sellerId: ids.sellerOne,
      categoryId: ids.electronics,
      title: 'Development Laptop',
      description: 'Laptop listing for local development and API testing',
      price: 25000000,
      stock: 8,
      images: ['https://example.test/images/laptop.jpg'],
      attributes: [
        {
          name: 'RAM',
          normalizedName: 'ram',
          value: 16,
          dataType: 'number',
          unit: 'GB',
        },
        {
          name: 'Refurbished',
          normalizedName: 'refurbished',
          value: false,
          dataType: 'boolean',
        },
      ],
      status: 'ACTIVE',
    },
    {
      _id: ids.shoes,
      uuid: ids.shoesUuid,
      sellerId: ids.sellerTwo,
      categoryId: ids.fashion,
      title: 'Development Running Shoes',
      description: 'Running shoes listing for local development',
      price: 1500000,
      stock: 12,
      images: ['https://example.test/images/shoes.jpg'],
      attributes: [
        {
          name: 'Material',
          normalizedName: 'material',
          value: 'Mesh',
          dataType: 'string',
        },
      ],
      status: 'ACTIVE',
    },
    {
      _id: ids.headphones,
      uuid: ids.headphonesUuid,
      sellerId: ids.sellerOne,
      categoryId: ids.electronics,
      title: 'Development Headphones',
      description: 'Out-of-stock listing for buyer visibility testing',
      price: 2200000,
      stock: 0,
      images: ['https://example.test/images/headphones.jpg'],
      attributes: [],
      status: 'OUT_OF_STOCK',
    },
    {
      _id: ids.hiddenProduct,
      uuid: ids.hiddenProductUuid,
      sellerId: ids.sellerOne,
      categoryId: ids.electronics,
      title: 'Hidden Development Product',
      description: 'Must not be visible through buyer APIs',
      price: 100000,
      stock: 1,
      images: [],
      attributes: [],
      status: 'HIDDEN',
    },
    ...additionalProducts,
    ...auctionAndOfferProducts,
  ]);

  await ProductReview.create(productReviewFixtures);
  const reviewAggregates = await ProductReview.aggregate([
    { $match: { productId: { $in: productIds } } },
    {
      $group: {
        _id: '$productId',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);
  if (reviewAggregates.length) {
    await Product.bulkWrite(
      reviewAggregates.map(({ _id, averageRating, reviewCount }) => ({
        updateOne: {
          filter: { _id },
          update: {
            $set: {
              averageRating: Math.round(averageRating * 100) / 100,
              reviewCount,
            },
          },
        },
      })),
    );
  }

  const seedUser3Fixtures = () =>
    Coupon.create(
      [
        {
          _id: ids.percentageCoupon,
          code: 'SAVE10',
          description: 'Ten percent',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          startsAt: FIXTURE_START,
          expiresAt: FIXTURE_EXPIRY,
          perUserLimit: 3,
        },
        {
          _id: ids.fixedCoupon,
          code: 'FIXED100K',
          description: 'Fixed discount',
          discountType: 'FIXED_AMOUNT',
          discountValue: 100000,
          startsAt: FIXTURE_START,
          expiresAt: FIXTURE_EXPIRY,
        },
        {
          _id: ids.expiredCoupon,
          code: 'EXPIRED',
          description: 'Expired coupon',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          startsAt: FIXTURE_EXPIRED_START,
          expiresAt: FIXTURE_EXPIRED_END,
        },
        {
          _id: ids.inactiveCoupon,
          code: 'INACTIVE',
          description: 'Inactive coupon',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          startsAt: FIXTURE_START,
          expiresAt: FIXTURE_EXPIRY,
          status: 'INACTIVE',
        },
        {
          _id: ids.minimumCoupon,
          code: 'MINIMUM',
          description: 'Minimum coupon',
          discountType: 'FIXED_AMOUNT',
          discountValue: 100000,
          minOrderValue: 30000000,
          startsAt: FIXTURE_START,
          expiresAt: FIXTURE_EXPIRY,
        },
        {
          _id: ids.cappedCoupon,
          code: 'CAPPED',
          description: 'Capped percentage',
          discountType: 'PERCENTAGE',
          discountValue: 50,
          maxDiscount: 200000,
          startsAt: FIXTURE_START,
          expiresAt: FIXTURE_EXPIRY,
        },
        {
          _id: ids.limitedCoupon,
          code: 'LIMITED',
          description: 'Limited coupon',
          discountType: 'FIXED_AMOUNT',
          discountValue: 50000,
          startsAt: FIXTURE_START,
          expiresAt: FIXTURE_EXPIRY,
          usageLimit: 1,
          usageCount: 1,
          perUserLimit: 1,
        },
      ].map(withFixtureTimestamps),
    );
  await seedUser3Fixtures();

  const seedUser4Fixtures = async () => {
    await Order.create(
      withFixtureTimestamps({
        _id: ids.order,
        buyerId: ids.buyerUser,
        checkoutGroupId: ids.checkoutGroup,
        sellerId: ids.sellerOne,
        orderStatus: 'DELIVERED',
        paymentMethod: 'COD',
        subtotal: 25000000,
        discount: 0,
        shippingFee: 0,
        total: 25000000,
        deliveredAt: FIXTURE_NOW,
        items: [
          {
            _id: ids.orderItem,
            productId: ids.laptop,
            sellerId: ids.sellerOne,
            quantity: 1,
          },
        ],
      }),
    );
    await Payment.create(
      withFixtureTimestamps({
        _id: ids.payment,
        buyerId: ids.buyerUser,
        checkoutGroupId: ids.checkoutGroup,
        method: 'COD',
        status: 'CONFIRMED',
        amount: 25000000,
        currency: 'VND',
      }),
    );
    await CheckoutGroup.create(
      withFixtureTimestamps({
        _id: ids.checkoutGroup,
        buyerId: ids.buyerUser,
        orderIds: [ids.order],
        paymentId: ids.payment,
        paymentMethod: 'COD',
        status: 'CONFIRMED',
        subtotal: 25000000,
        discount: 0,
        shippingFee: 0,
        total: 25000000,
        currency: 'VND',
      }),
    );
    await ReturnRequest.create(
      withFixtureTimestamps({
        _id: ids.returnRequest,
        buyerId: ids.buyerUser,
        orderId: ids.order,
        orderItemId: ids.orderItem,
        sellerId: ids.sellerOne,
        productId: ids.laptop,
        quantity: 1,
        reason: 'DAMAGED',
        details: 'Deterministic development return fixture',
        status: 'REQUESTED',
      }),
    );
  };
  await seedUser4Fixtures();
};

try {
  await seed();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
