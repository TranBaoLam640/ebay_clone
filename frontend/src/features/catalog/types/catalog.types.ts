export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'OUT_OF_STOCK' | 'HIDDEN' | 'DELETED';
export type CategoryStatus = 'ACTIVE' | 'INACTIVE';
export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'rating_desc';
export type ListingType = 'FIXED' | 'AUCTION';
export type AuctionStatus = 'SCHEDULED' | 'OPEN' | 'CLOSED';

/**
 * Public auction state carried on availability/detail payloads. Never includes
 * the hidden leader max, the leader's identity, or the reserve amount — only the
 * derived `reserveMet` boolean and whether Buy It Now is still available.
 */
export interface AuctionInfo {
  currentBid: number;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  status: AuctionStatus;
  hasReserve: boolean;
  reserveMet: boolean;
  buyNowAvailable: boolean;
  buyNowPrice: number | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
  status: CategoryStatus;
}

export interface SellerSummary {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  averageFeedbackRating: number;
  feedbackCount: number;
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

export interface CatalogProductSummary {
  id: string;
  ePID: string;
  name: string;
  brand?: string | null;
  model?: string | null;
}

export interface ProductReviewSummary {
  available?: boolean;
  averageRating: number | null;
  reviewCount: number;
  ratingHistogram: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface ProductListItem {
  id: string;
  title: string;
  primaryImage: string | null;
  price: number;
  stock: number;
  status: ProductStatus;
  listingType?: ListingType;
  offersEnabled?: boolean;
  productReviewAvailable?: boolean;
  averageRating: number | null;
  reviewCount: number;
  reviewSummary: ProductReviewSummary | null;
  catalogProduct: CatalogProductSummary | null;
  seller: SellerSummary;
  category: CategorySummary;
}

/** Listing-format facet for the catalog filter (auction vs. Best-Offer items). */
export type ProductFormat = 'auction' | 'offerable';

export interface ProductAttribute {
  name: string;
  normalizedName: string;
  value: string | number | boolean;
  dataType: 'string' | 'number' | 'boolean' | 'date';
  unit: string | null;
}

export interface ProductReview {
  id: string;
  rating: number;
  comment: string | null;
  verifiedPurchase: boolean;
  buyer?: { id: string; displayName: string; avatarUrl: string | null } | null;
  reviewer: { fullName: string; avatarUrl: string | null };
  purchasedProduct?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetail extends Omit<ProductListItem, 'primaryImage'> {
  description: string;
  images: string[];
  attributes: ProductAttribute[];
  recentReviews: ProductReview[];
  listingType: ListingType;
  offersEnabled: boolean;
  auction?: AuctionInfo;
  createdAt: string;
  updatedAt: string;
}

/** Live stock/status for one product, polled while it is on screen. */
export interface ProductAvailability {
  id: string;
  stock: number;
  status: ProductStatus;
  listingType?: ListingType;
  auction?: AuctionInfo;
}

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  sellerId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  format?: ProductFormat;
  sort?: ProductSort;
}
