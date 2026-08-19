import { Product } from './product.model.js';

const visibleStatuses = ['ACTIVE', 'OUT_OF_STOCK'];
const sorts = {
  newest: { createdAt: -1, _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: -1 },
  rating_desc: { averageRating: -1, reviewCount: -1, _id: -1 },
};
const id = (value) => new Product.db.base.Types.ObjectId(value);
const relations = [
  {
    $lookup: {
      from: 'sellerprofiles',
      localField: 'sellerId',
      foreignField: '_id',
      pipeline: [
        { $match: { status: 'ACTIVE' } },
        {
          $project: {
            _id: 0,
            id: '$_id',
            displayName: 1,
            avatarUrl: 1,
            averageFeedbackRating: 1,
            feedbackCount: 1,
          },
        },
      ],
      as: 'seller',
    },
  },
  { $unwind: '$seller' },
  {
    $lookup: {
      from: 'categories',
      localField: 'categoryId',
      foreignField: '_id',
      pipeline: [
        { $match: { status: 'ACTIVE' } },
        { $project: { _id: 0, id: '$uuid', name: 1, slug: 1 } },
      ],
      as: 'category',
    },
  },
  { $unwind: '$category' },
  {
    $lookup: {
      from: 'catalogproducts',
      localField: 'catalogProductId',
      foreignField: '_id',
      pipeline: [
        {
          $project: {
            _id: 0,
            id: '$_id',
            ePID: 1,
            name: 1,
            brand: 1,
            model: 1,
          },
        },
      ],
      as: 'catalogProduct',
    },
  },
  { $unwind: { path: '$catalogProduct', preserveNullAndEmptyArrays: true } },
];
const normalizedStock = {
  $cond: [{ $eq: ['$status', 'OUT_OF_STOCK'] }, 0, '$stock'],
};
const summaryProjection = {
  _id: 0,
  id: '$uuid',
  title: 1,
  primaryImage: { $ifNull: [{ $arrayElemAt: ['$images', 0] }, null] },
  price: 1,
  stock: normalizedStock,
  status: 1,
  // Lets catalog cards flag auctions (no add-to-cart; "starting bid" framing).
  listingType: { $ifNull: ['$listingType', 'FIXED'] },
  // Lets catalog cards flag Best-Offer items and powers the "offerable" filter.
  offersEnabled: { $ifNull: ['$offersEnabled', false] },
  averageRating: 1,
  reviewCount: 1,
  productReviewAvailable: 1,
  reviewSummary: 1,
  catalogProduct: {
    $cond: ['$productReviewAvailable', '$catalogProduct', null],
  },
  seller: 1,
  category: 1,
};

const reviewSummaryLookup = [
  {
    $lookup: {
      from: 'productreviews',
      localField: 'catalogProductId',
      foreignField: 'catalogProductId',
      pipeline: [
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            reviewCount: { $sum: 1 },
            oneStar: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
            twoStar: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            threeStar: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            fourStar: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            fiveStar: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            averageRating: { $round: ['$averageRating', 2] },
            reviewCount: 1,
            ratingHistogram: {
              1: '$oneStar',
              2: '$twoStar',
              3: '$threeStar',
              4: '$fourStar',
              5: '$fiveStar',
            },
          },
        },
      ],
      as: 'reviewSummary',
    },
  },
  {
    $set: {
      reviewSummary: { $arrayElemAt: ['$reviewSummary', 0] },
      productReviewAvailable: {
        $gt: [{ $strLenCP: { $ifNull: ['$catalogProduct.ePID', ''] } }, 0],
      },
      averageRating: {
        $ifNull: [{ $arrayElemAt: ['$reviewSummary.averageRating', 0] }, 0],
      },
      reviewCount: {
        $ifNull: [{ $arrayElemAt: ['$reviewSummary.reviewCount', 0] }, 0],
      },
    },
  },
  {
    $set: {
      reviewSummary: {
        $cond: [
          '$productReviewAvailable',
          {
            averageRating: { $ifNull: ['$reviewSummary.averageRating', null] },
            reviewCount: { $ifNull: ['$reviewSummary.reviewCount', 0] },
            ratingHistogram: {
              $ifNull: [
                '$reviewSummary.ratingHistogram',
                { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
              ],
            },
          },
          null,
        ],
      },
      averageRating: {
        $cond: ['$productReviewAvailable', '$averageRating', null],
      },
      reviewCount: {
        $cond: ['$productReviewAvailable', '$reviewCount', 0],
      },
    },
  },
];

export const listVisible = async ({
  search,
  categoryId,
  sellerId,
  minPrice,
  maxPrice,
  inStock,
  format,
  sort,
  page,
  limit,
}) => {
  const match = { status: { $in: visibleStatuses } };
  if (categoryId) match.categoryId = id(categoryId);
  if (sellerId) match.sellerId = id(sellerId);
  if (minPrice !== undefined || maxPrice !== undefined) {
    match.price = {};
    if (minPrice !== undefined) match.price.$gte = minPrice;
    if (maxPrice !== undefined) match.price.$lte = maxPrice;
  }
  if (inStock === true) {
    match.status = 'ACTIVE';
    match.stock = { $gt: 0 };
  }
  if (inStock === false) match.status = 'OUT_OF_STOCK';
  // Listing format facet (mutually exclusive): auctions vs. Best-Offer items.
  if (format === 'auction') match.listingType = 'AUCTION';
  if (format === 'offerable') match.offersEnabled = true;
  if (search) match.$text = { $search: search };

  const [result] = await Product.aggregate([
    { $match: match },
    ...relations,
    { $sort: sorts[sort] },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          ...reviewSummaryLookup,
          { $project: summaryProjection },
        ],
        total: [{ $count: 'count' }],
      },
    },
    {
      $project: {
        items: 1,
        totalItems: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
      },
    },
  ]);
  return result || { items: [], totalItems: 0 };
};

export const updateReviewAggregate = (productId, aggregate, session) =>
  Product.findByIdAndUpdate(productId, aggregate, {
    returnDocument: 'after',
    runValidators: true,
    session,
  })
    .lean()
    .exec();

export const updateCatalogReviewAggregate = (
  catalogProductId,
  aggregate,
  session,
) =>
  Product.updateMany(
    { catalogProductId },
    {
      averageRating: aggregate.averageRating ?? 0,
      reviewCount: aggregate.reviewCount,
    },
    { session, runValidators: true },
  );

export const findBuyerCartProducts = (productIds, session) =>
  Product.aggregate([
    { $match: { _id: { $in: productIds.map(id) } } },
    {
      $lookup: {
        from: 'sellerprofiles',
        localField: 'sellerId',
        foreignField: '_id',
        pipeline: [{ $project: { displayName: 1, status: 1 } }],
        as: 'seller',
      },
    },
    { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'categories',
        localField: 'categoryId',
        foreignField: '_id',
        pipeline: [{ $project: { status: 1 } }],
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        uuid: 1,
        title: 1,
        primaryImage: { $ifNull: [{ $arrayElemAt: ['$images', 0] }, null] },
        price: 1,
        stock: 1,
        status: 1,
        listingType: 1,
        sellerId: 1,
        seller: 1,
        // AUCTION listings are never cart-purchasable — they sell through the
        // bidding/Buy-It-Now flow. `$ne AUCTION` keeps legacy FIXED docs (which
        // may predate the listingType field) purchasable.
        buyerVisible: {
          $and: [
            { $in: ['$status', visibleStatuses] },
            { $ne: ['$listingType', 'AUCTION'] },
            { $eq: ['$seller.status', 'ACTIVE'] },
            { $eq: ['$category.status', 'ACTIVE'] },
          ],
        },
      },
    },
  ]).session(session || null);

export const deductStock = (productId, quantity, session) =>
  Product.findOneAndUpdate(
    { _id: productId, status: 'ACTIVE', stock: { $gte: quantity } },
    [
      { $set: { stock: { $subtract: ['$stock', quantity] } } },
      {
        $set: {
          status: {
            $cond: [{ $eq: ['$stock', 0] }, 'OUT_OF_STOCK', '$status'],
          },
        },
      },
    ],
    { session, returnDocument: 'after', updatePipeline: true },
  ).lean();
export const restoreStock = (productId, quantity, session) =>
  Product.updateOne(
    { _id: productId, status: { $in: ['ACTIVE', 'OUT_OF_STOCK'] } },
    [
      { $set: { stock: { $add: ['$stock', quantity] } } },
      {
        $set: {
          status: {
            $cond: [{ $gt: ['$stock', 0] }, 'ACTIVE', '$status'],
          },
        },
      },
    ],
    { session, updatePipeline: true },
  );

/**
 * Resolve a public product uuid → internal ObjectId (or null if not found).
 * The bridge between client-facing uuids and internal foreign keys.
 */
export const resolveIdByUuid = async (uuid) => {
  const doc = await Product.findOne({ uuid }).select('_id').lean();
  return doc?._id ?? null;
};

/** Resolve many uuids → Map(uuid → ObjectId) in one query. */
export const resolveIdsByUuids = async (uuids) => {
  const docs = await Product.find({ uuid: { $in: uuids } })
    .select('_id uuid')
    .lean();
  return new Map(docs.map((doc) => [doc.uuid, doc._id]));
};

/**
 * Resolve many internal ObjectIds → Map(idString → uuid) in one query. Used to
 * expose the public product uuid on stored references (e.g. order items).
 */
export const resolveUuidsByIds = async (ids) => {
  const docs = await Product.find({ _id: { $in: ids } })
    .select('_id uuid')
    .lean();
  return new Map(docs.map((doc) => [String(doc._id), doc.uuid]));
};

export const reviewAvailabilityByIds = async (ids) => {
  const docs = await Product.aggregate([
    { $match: { _id: { $in: ids.map(id) } } },
    {
      $lookup: {
        from: 'catalogproducts',
        localField: 'catalogProductId',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 1, ePID: 1, name: 1 } }],
        as: 'catalogProduct',
      },
    },
    { $unwind: { path: '$catalogProduct', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'sellerprofiles',
        localField: 'sellerId',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 1, userId: 1 } }],
        as: 'seller',
      },
    },
    { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        uuid: 1,
        sellerUserId: '$seller.userId',
        productReviewAvailable: {
          $gt: [{ $strLenCP: { $ifNull: ['$catalogProduct.ePID', ''] } }, 0],
        },
        catalogProduct: {
          $cond: [
            {
              $gt: [
                { $strLenCP: { $ifNull: ['$catalogProduct.ePID', ''] } },
                0,
              ],
            },
            {
              id: '$catalogProduct._id',
              ePID: '$catalogProduct.ePID',
              name: '$catalogProduct.name',
            },
            null,
          ],
        },
      },
    },
  ]);
  return new Map(docs.map((doc) => [String(doc._id), doc]));
};

// Live auction fields projected onto availability/detail payloads. Never
// exposes the hidden leader max, leader id, or the reserve amount — only the
// derived `reserveMet` boolean and whether Buy It Now is still available.
const auctionAvailabilityFields = {
  listingType: 1,
  auction: {
    $cond: [
      { $eq: ['$listingType', 'AUCTION'] },
      {
        currentBid: '$auction.currentBid',
        bidCount: '$auction.bidCount',
        startsAt: '$auction.startsAt',
        endsAt: '$auction.endsAt',
        status: '$auction.status',
        hasReserve: {
          $ne: [{ $ifNull: ['$auction.reservePrice', null] }, null],
        },
        reserveMet: '$auction.reserveMet',
        // Mirrors proxy-engine.isBuyNowAvailable: BIN survives the first bid on
        // a reserve listing until a bid actually meets the reserve.
        buyNowAvailable: {
          $and: [
            { $eq: ['$auction.status', 'OPEN'] },
            { $gt: [{ $ifNull: ['$auction.buyNowPrice', 0] }, 0] },
            {
              $gt: [
                { $ifNull: ['$auction.buyNowPrice', 0] },
                '$auction.currentBid',
              ],
            },
            {
              $or: [
                { $eq: ['$auction.bidCount', 0] },
                {
                  $and: [
                    {
                      $ne: [{ $ifNull: ['$auction.reservePrice', null] }, null],
                    },
                    { $ne: ['$auction.reserveMet', true] },
                  ],
                },
              ],
            },
          ],
        },
        buyNowPrice: { $ifNull: ['$auction.buyNowPrice', null] },
      },
      '$$REMOVE',
    ],
  },
};

/**
 * Live availability for a batch of public uuids — the lean payload polled by
 * buyers viewing a product or with the cart open. Only buyer-visible products
 * are returned; a uuid absent from the result means the product is no longer
 * on sale (hidden/deleted), which the client renders as "unavailable".
 * Auction listings additionally carry their live current bid / countdown state.
 */
export const findAvailabilityByUuids = (uuids) =>
  Product.aggregate([
    { $match: { uuid: { $in: uuids }, status: { $in: visibleStatuses } } },
    {
      $project: {
        _id: 0,
        id: '$uuid',
        stock: normalizedStock,
        status: 1,
        ...auctionAvailabilityFields,
      },
    },
  ]);

// Offerable-listing lookup (for creating a Best Offer): a buyer-visible product.
export const findOfferable = (productId) =>
  Product.findOne({ _id: productId, status: { $in: visibleStatuses } })
    .select('uuid title images listingType offersEnabled status price stock')
    .lean();

// Map(idString → { uuid, title, images }) for a batch of ids (offers list).
export const findPublicByIds = async (ids) => {
  const docs = await Product.find({ _id: { $in: ids } })
    .select('uuid title images')
    .lean();
  return new Map(docs.map((doc) => [String(doc._id), doc]));
};

export const findByInternalId = (productId, session) =>
  Product.findById(productId)
    .select('_id uuid sellerId catalogProductId title')
    .session(session || null)
    .lean();

export const findVisibleInternalByUuid = (productUuid) =>
  Product.findOne({ uuid: productUuid, status: { $in: visibleStatuses } })
    .select('_id uuid sellerId catalogProductId')
    .lean();

// Map(idString → auction product) for a batch of ids (My Bids).
export const findAuctionsByIds = async (ids) => {
  const docs = await Product.find({ _id: { $in: ids }, listingType: 'AUCTION' })
    .select('uuid title images listingType auction')
    .lean();
  return new Map(docs.map((doc) => [String(doc._id), doc]));
};

export const findVisibleById = async (productUuid) => {
  const [product] = await Product.aggregate([
    { $match: { uuid: productUuid, status: { $in: visibleStatuses } } },
    ...relations,
    ...reviewSummaryLookup,
    {
      $project: {
        _id: 0,
        id: '$uuid',
        title: 1,
        description: 1,
        price: 1,
        stock: normalizedStock,
        status: 1,
        images: 1,
        attributes: {
          $map: {
            input: '$attributes',
            as: 'attribute',
            in: {
              name: '$$attribute.name',
              normalizedName: '$$attribute.normalizedName',
              value: '$$attribute.value',
              dataType: '$$attribute.dataType',
              unit: '$$attribute.unit',
            },
          },
        },
        averageRating: 1,
        reviewCount: 1,
        productReviewAvailable: 1,
        reviewSummary: 1,
        catalogProduct: {
          $cond: ['$productReviewAvailable', '$catalogProduct', null],
        },
        seller: 1,
        category: 1,
        offersEnabled: { $ifNull: ['$offersEnabled', false] },
        ...auctionAvailabilityFields,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);
  return product || null;
};
