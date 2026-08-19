import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useProduct } from '@/features/catalog/hooks/use-catalog';
import { useAvailability } from '@/features/catalog/hooks/use-availability';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { resolveLiveStock } from '@/features/cart/utils/line-availability';
import { ImageGallery } from '../components/image-gallery';
import { AttributeTable } from '../components/attribute-table';
import { SellerCard } from '../components/seller-card';
import { ReviewList } from '../components/review-list';
import { AuctionBuyBox } from '../components/auction-buy-box';
import { BidderStatusBanner } from '../components/bidder-status-banner';
import { BidHistoryList } from '../components/bid-history-list';
import { MakeOfferButton } from '../components/make-offer';
import { useAuctionRealtime } from '../hooks/use-auction-realtime';
import { Price } from '@/components/price';
import { Rating } from '@/components/rating';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { useCart } from '@/features/cart/cart-context';
import { useToast } from '@/contexts/toast-context';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';
import { messagingApi } from '@/features/messages/services/messaging-api';
import { messageFromError } from '@/features/auth/utils/auth-errors';

/** Full product detail: gallery, buy box, specs, seller, reviews. */
export default function ProductDetailPage() {
  const { t } = useTranslation();
  const { productId } = useParams<{ productId: string }>();
  const { data: product, isLoading, isError } = useProduct(productId);
  const { add } = useCart();
  const { notify } = useToast();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const contactSeller = useMutation({
    mutationFn: () =>
      messagingApi.createConversation({ productId: product!.id }),
    onSuccess: (conversation) => navigate(paths.message(conversation.id)),
    onError: (err) => notify(messageFromError(err), 'error'),
  });

  const isAuction = product?.listingType === 'AUCTION';
  const isOwnListing = user?.sellerProfile?.id === product?.seller.id;
  // Live per-buyer auction state (5s poll). Null for fixed-price listings.
  const auctionRealtime = useAuctionRealtime(
    product?.id ?? '',
    product?.auction,
    isAuction,
    isAuthenticated,
  );

  // Poll live stock/status while this product is on screen so the buy box
  // reflects out-of-stock / low-stock without a manual reload (fixed listings).
  const availability = useAvailability(
    product && !isAuction ? [product.id] : [],
  );
  const {
    liveStock,
    removed,
    outOfStock: liveOutOfStock,
  } = resolveLiveStock(
    { stock: product?.stock ?? 0, status: product?.status },
    product ? availability.map.get(product.id) : undefined,
    availability.loaded,
  );

  // Clamp the selected quantity down if live stock shrinks beneath it.
  useEffect(() => {
    setQty((q) => Math.min(q, Math.max(1, liveStock)));
  }, [liveStock]);

  if (isLoading) return <DetailSkeleton />;

  if (isError || !product) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-16">
        <EmptyState
          title={t('productDetail.notFoundTitle')}
          description={t('productDetail.notFoundDescription')}
          action={
            <Link to={paths.products}>
              <Button variant="secondary">
                {t('productDetail.backToProducts')}
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const outOfStock = liveOutOfStock;
  const exceedsStock = !outOfStock && qty > liveStock;

  const addToCart = () => {
    if (outOfStock || exceedsStock) return;
    add({
      productId: product.id,
      title: product.title,
      price: product.price,
      image: product.images[0] ?? null,
      sellerName: product.seller.displayName,
      quantity: qty,
      stock: liveStock,
    });
    notify(t('productDetail.addedToCart'), 'success');
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8">
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted">
        <Link to={paths.home} className="hover:text-primary">
          {t('productDetail.breadcrumbHome')}
        </Link>
        <Icon variant="icon-chevron-right" size={14} />
        <Link
          to={`${paths.products}?categoryId=${product.category.id}`}
          className="hover:text-primary"
        >
          {product.category.name}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <ImageGallery images={product.images} title={product.title} />

        <div className="flex flex-col gap-4">
          {isAuction && auctionRealtime ? (
            <>
              <BidderStatusBanner auction={auctionRealtime} />
              <h1 className="text-2xl font-extrabold text-text">
                {product.title}
              </h1>
              {product.productReviewAvailable && (
                <Rating
                  value={product.reviewSummary?.averageRating}
                  count={product.reviewSummary?.reviewCount ?? 0}
                  showValue
                  size={18}
                />
              )}
              <p className="text-sm leading-relaxed text-muted">
                {product.description}
              </p>
              <AuctionBuyBox
                uuid={product.id}
                auction={auctionRealtime}
                isAuthenticated={isAuthenticated}
              />
              <SellerCard seller={product.seller} productId={product.id} />
            </>
          ) : (
            <>
              <div>
                {removed ? (
                  <Badge tone="danger">
                    {t('productDetail.noLongerAvailable')}
                  </Badge>
                ) : outOfStock ? (
                  <Badge tone="danger">{t('productDetail.outOfStock')}</Badge>
                ) : (
                  <Badge tone="success">{t('productDetail.inStock')}</Badge>
                )}
                <h1 className="mt-2 text-2xl font-extrabold text-text">
                  {product.title}
                </h1>
              </div>

              {product.productReviewAvailable && (
                <Rating
                  value={product.reviewSummary?.averageRating}
                  count={product.reviewSummary?.reviewCount ?? 0}
                  showValue
                  size={18}
                />
              )}

              <Price cents={product.price} className="text-3xl" />

              <p className="text-sm leading-relaxed text-muted">
                {product.description}
              </p>

              {!outOfStock && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-sm text-muted">
                    {t('productDetail.quantity')}
                  </span>
                  <div className="flex items-center rounded-md border border-border">
                    <button
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="flex h-10 w-10 items-center justify-center text-text hover:bg-surface-2"
                      aria-label={t('productDetail.decreaseQty')}
                    >
                      <Icon variant="icon-minus" size={16} />
                    </button>
                    <span className="w-12 text-center text-sm font-semibold text-text">
                      {qty}
                    </span>
                    <button
                      onClick={() => setQty((q) => Math.min(liveStock, q + 1))}
                      disabled={qty >= liveStock}
                      className="flex h-10 w-10 items-center justify-center text-text hover:bg-surface-2 disabled:opacity-40"
                      aria-label={t('productDetail.increaseQty')}
                    >
                      <Icon variant="icon-plus" size={16} />
                    </button>
                  </div>
                  <span className="text-sm text-muted">
                    {t('productDetail.stockAvailable', { count: liveStock })}
                  </span>
                </div>
              )}

              {removed && (
                <p className="text-sm font-medium text-danger">
                  {t('productDetail.removedNote')}
                </p>
              )}
              {exceedsStock && (
                <p className="text-sm font-medium text-danger">
                  {t('productDetail.stockInsufficient', { count: liveStock })}
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  size="lg"
                  variant="accent"
                  onClick={addToCart}
                  disabled={outOfStock || exceedsStock}
                  className="flex-1"
                >
                  <Icon variant="icon-cart" size={20} />
                  {removed
                    ? t('productDetail.noLongerAvailable')
                    : outOfStock
                      ? t('productDetail.outOfStock')
                      : t('productDetail.addToCart')}
                </Button>
                {isAuthenticated && !isOwnListing && (
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => contactSeller.mutate()}
                    loading={contactSeller.isPending}
                    disabled={removed}
                  >
                    <Icon variant="icon-mail" size={20} />
                    Contact Seller
                  </Button>
                )}
              </div>

              {product.offersEnabled && (
                <MakeOfferButton
                  uuid={product.id}
                  isAuthenticated={isAuthenticated}
                  stock={liveStock}
                  price={product.price}
                />
              )}

              <SellerCard seller={product.seller} productId={product.id} />
            </>
          )}
        </div>
      </div>

      {/* Specs + bid history: only pair into two columns when BOTH have content,
          otherwise let the present block span full width (avoids a lopsided grid
          when an auction has no attributes). */}
      <div
        className={cn(
          'mt-12 gap-10',
          product.attributes.length > 0 && isAuction
            ? 'grid lg:grid-cols-2'
            : 'flex flex-col',
        )}
      >
        <AttributeTable attributes={product.attributes} />
        {isAuction && <BidHistoryList uuid={product.id} enabled />}
      </div>

      <div className="mt-12">
        <ReviewList product={product} />
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
