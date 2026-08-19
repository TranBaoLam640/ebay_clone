import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useProductReviews } from '@/features/catalog/hooks/use-catalog';
import type {
  ProductDetail,
  ProductReviewSummary,
} from '@/features/catalog/types/catalog.types';
import { Rating } from '@/components/rating';
import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Input } from '@/components/input';
import { Pagination } from '@/components/pagination';
import { Select } from '@/components/select';
import { Skeleton } from '@/components/skeleton';
import { EmptyState } from '@/components/empty-state';
import { formatDate } from '@/utils/format-date';
import { paths } from '@/routes/paths';

const ratingKeys = ['5', '4', '3', '2', '1'] as const;

interface ReviewListProps {
  product: ProductDetail;
}

export function ReviewList({ product }: ReviewListProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const available = Boolean(
    product.productReviewAvailable && product.catalogProduct?.ePID,
  );
  const summary = product.reviewSummary;

  const sortOptions = useMemo(
    () => [
      { value: 'newest', label: t('productDetail.sortNewest') },
      { value: 'highest', label: t('productDetail.sortRatingHigh') },
      { value: 'lowest', label: t('productDetail.sortRatingLow') },
      { value: 'oldest', label: t('productDetail.sortOldest') },
    ],
    [t],
  );

  const reviews = useProductReviews(
    product.id,
    {
      page,
      limit: 10,
      sort,
      q: query || undefined,
    },
    available,
  );

  if (!available || !summary) return null;

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(searchInput.trim());
    setPage(1);
  };

  const reviewCount = summary.reviewCount;
  const emptySearch = Boolean(query) && (reviews.data?.items.length ?? 0) === 0;

  return (
    <section className="border-t border-border pt-8">
      <h2 className="text-xl font-bold text-text">
        {t('productDetail.ratingsAndReviews')}
      </h2>

      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(12rem,18rem)_1fr]">
        <RatingOverview summary={summary} />
        <RatingHistogram summary={summary} />
      </div>

      <div className="mt-8 border-t border-border pt-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h3 className="text-lg font-bold text-text">
            {t('productDetail.reviewCountTitle', { count: reviewCount })}
          </h3>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem] lg:w-[36rem]">
            <form
              onSubmit={submitSearch}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t('productDetail.searchReviews')}
                aria-label={t('productDetail.searchReviews')}
              />
              <Button type="submit" variant="secondary">
                <Icon variant="icon-search" size={16} />
                {t('productDetail.search')}
              </Button>
            </form>

            <Select
              options={sortOptions}
              value={sort}
              onValueChange={(value) => {
                setSort(value);
                setPage(1);
              }}
              aria-label={t('productDetail.sortReviewsLabel')}
            />
          </div>
        </div>

        {reviews.isLoading ? (
          <div className="mt-5 flex flex-col gap-4">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : (reviews.data?.items.length ?? 0) === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon="icon-star"
              title={
                emptySearch
                  ? t('productDetail.noReviewsMatchTitle')
                  : t('productDetail.noProductReviewsYet')
              }
            />
          </div>
        ) : (
          <ul className="mt-5 flex flex-col divide-y divide-border">
            {reviews.data!.items.map((review) => {
              const buyerName =
                review.buyer?.displayName ?? review.reviewer.fullName;
              const description = review.description || review.comment;
              return (
                <li key={review.id} className="py-5">
                  <div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
                    <div className="flex gap-3 md:block">
                      <Avatar
                        src={
                          review.buyer?.avatarUrl ?? review.reviewer.avatarUrl
                        }
                        name={buyerName}
                        size={40}
                        className="md:mb-3"
                      />
                      <div className="min-w-0">
                        <Rating value={review.rating} size={15} />
                        <p className="mt-1 text-sm font-semibold text-text">
                          {t('productDetail.byBuyer', { name: buyerName })}
                        </p>
                        <p className="text-sm text-muted">
                          {formatDate(review.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-text">
                        {review.title}
                      </h4>
                      {description && (
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text">
                          {description}
                        </p>
                      )}
                      {review.verifiedPurchase && (
                        <Badge tone="success" className="mt-4 w-fit">
                          {t('productDetail.verifiedPurchase')}
                        </Badge>
                      )}
                      {review.purchasedProduct && (
                        <div className="mt-3 text-sm">
                          <Link
                            to={paths.product(review.purchasedProduct.id)}
                            className="font-medium text-text underline decoration-border underline-offset-2 hover:text-primary"
                          >
                            {review.purchasedProduct.name}
                          </Link>
                          {review.soldBy && (
                            <p className="mt-1 text-muted">
                              {t('productDetail.soldBy', {
                                name: review.soldBy.displayName,
                              })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {reviews.data?.meta && reviews.data.meta.totalPages > 1 && (
          <div className="mt-6">
            <Pagination
              page={reviews.data.meta.page}
              totalPages={reviews.data.meta.totalPages}
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function RatingOverview({ summary }: { summary: ProductReviewSummary }) {
  const { t } = useTranslation();
  const hasReviews = summary.reviewCount > 0 && summary.averageRating !== null;
  return (
    <div>
      <div className="flex items-end gap-3">
        <span className="text-5xl font-bold leading-none text-text">
          {hasReviews ? summary.averageRating!.toFixed(1) : '-'}
        </span>
        {hasReviews && <Rating value={summary.averageRating} size={22} />}
      </div>
      <p className="mt-3 text-sm text-muted">
        {t('productDetail.productRatings', { count: summary.reviewCount })}
      </p>
    </div>
  );
}

function RatingHistogram({ summary }: { summary: ProductReviewSummary }) {
  return (
    <div className="flex flex-col gap-2">
      {ratingKeys.map((key) => {
        const count = summary.ratingHistogram[key] ?? 0;
        const width =
          summary.reviewCount > 0 ? (count / summary.reviewCount) * 100 : 0;
        return (
          <div
            key={key}
            className="grid grid-cols-[1.5rem_1rem_minmax(0,1fr)_2rem] items-center gap-2 text-sm text-text"
          >
            <span>{key}</span>
            <Icon variant="icon-star-fill" size={13} className="text-rating" />
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-rating"
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="text-right text-muted">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
